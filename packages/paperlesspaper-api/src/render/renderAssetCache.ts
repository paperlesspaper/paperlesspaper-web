import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import {
  getAllowedPrivateRenderOrigins,
  resolveRenderAddresses,
  resolveRenderUrl,
} from "./renderNetwork";

type Headers = Record<string, string>;
export type AssetRequest = {
  url: string;
  method: string;
  resourceType: string;
  headers: Headers;
};
export type CachedAsset = {
  body: Buffer;
  headers: Headers;
  expiresAt: number;
  storedAt: number;
};
export type AssetCacheStats = {
  hits: number;
  misses: number;
  coalesced: number;
  bypasses: number;
  bytesServed: number;
};
export const createAssetCacheStats = (): AssetCacheStats => ({
  hits: 0,
  misses: 0,
  coalesced: 0,
  bypasses: 0,
  bytesServed: 0,
});

const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 4_000;
const MAX_TTL_MS = 60 * 60 * 1000;
const types: Record<string, string[]> = {
  js: ["application/javascript", "text/javascript"],
  css: ["text/css"],
  woff: ["font/woff", "application/font-woff"],
  woff2: ["font/woff2"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  avif: ["image/avif"],
  svg: ["image/svg+xml"],
};

/** Only our published Next assets are eligible. Never cache arbitrary URLs,
 * documents, API calls, query tokens, or authenticated/conditional requests. */
export const getCacheableAssetUrl = (request: AssetRequest): URL | null => {
  if (process.env.RENDER_STATIC_CACHE_DISABLED === "true") return null;
  if (
    request.method !== "GET" ||
    !["script", "stylesheet", "font", "image"].includes(request.resourceType)
  )
    return null;
  const headers = Object.fromEntries(
    Object.entries(request.headers).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
  if (
    Object.keys(headers).some(
      (key) =>
        [
          "cookie",
          "authorization",
          "proxy-authorization",
          "range",
          "cache-control",
          "pragma",
        ].includes(key) || key.startsWith("if-")
    )
  )
    return null;
  try {
    const url = new URL(request.url);
    const root = new URL(
      resolveRenderUrl("https://apps.paperlesspaper.de/_next/static/")
    );
    if (
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(url.pathname) ||
      !types[url.pathname.split(".").pop() || ""]
    )
      return null;
    return url;
  } catch {
    return null;
  }
};

/** Conservative shared-cache policy; no personalization or representation variants. */
export const assetFreshnessMs = (
  headers: Headers,
  now = Date.now()
): number => {
  if (
    headers["set-cookie"] !== undefined ||
    headers["content-range"] !== undefined
  )
    return 0;
  if (
    headers["content-encoding"] &&
    headers["content-encoding"].toLowerCase() !== "identity"
  )
    return 0;
  if (
    (headers.vary || "")
      .split(",")
      .some(
        (value) =>
          value.trim() && value.trim().toLowerCase() !== "accept-encoding"
      )
  )
    return 0;
  const directives = new Map<string, string | undefined>();
  for (const part of (headers["cache-control"] || "").split(",")) {
    const [key, ...value] = part.trim().toLowerCase().split("=");
    if (!key || directives.has(key)) return 0;
    directives.set(
      key,
      value.length ? value.join("=").replace(/^"|"$/g, "") : undefined
    );
  }
  if (
    !directives.has("public") ||
    !directives.has("immutable") ||
    ["private", "no-store", "no-cache"].some((key) => directives.has(key))
  )
    return 0;
  const maxAge = directives.get("max-age");
  const sharedAge = directives.get("s-maxage") ?? maxAge;
  if (
    !maxAge ||
    !/^\d+$/.test(maxAge) ||
    !sharedAge ||
    !/^\d+$/.test(sharedAge)
  )
    return 0;
  const age = headers.age === undefined ? 0 : Number(headers.age);
  const date = headers.date === undefined ? now : Date.parse(headers.date);
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(date)) return 0;
  const remaining =
    Math.min(Number(maxAge), Number(sharedAge)) * 1000 -
    Math.max(age * 1000, now - date, 0);
  return Math.max(0, Math.min(MAX_TTL_MS, remaining));
};

/** Fetch anonymously with the same IP policy and DNS pinning as the render
 * proxy. No redirects, cookies, browser headers, decompression or ambient proxy.
 * TLS certificate verification remains enabled. Streaming has a hard byte cap. */
export const loadPublicRenderAsset = async (
  url: URL,
  allowed: Set<string>
): Promise<CachedAsset | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const addresses = await Promise.race([
      resolveRenderAddresses(url, allowed),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error("Asset timeout")),
          { once: true }
        )
      ),
    ]);
    if (controller.signal.aborted) return null;
    const lookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    };
    return await new Promise<CachedAsset | null>((resolve) => {
      const client = url.protocol === "https:" ? https : http;
      const request = client.get(
        url,
        {
          lookup,
          ...{ autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250 },
          agent: false,
          signal: controller.signal,
          maxHeaderSize: 16 * 1024,
          headers: { accept: "*/*", "accept-encoding": "identity" },
        },
        (response) => {
          const headers: Headers = {};
          for (const [key, value] of Object.entries(response.headers))
            if (value !== undefined)
              headers[key] = Array.isArray(value) ? value.join(",") : value;
          const ttl = assetFreshnessMs(headers);
          const mime = (headers["content-type"] || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
          const expectedTypes =
            types[url.pathname.split(".").pop() || ""] || [];
          if (
            response.statusCode !== 200 ||
            !ttl ||
            !expectedTypes.includes(mime) ||
            Number(headers["content-length"] || 0) > MAX_ASSET_BYTES
          ) {
            response.destroy();
            resolve(null);
            return;
          }
          const expiresAt = Date.now() + ttl;
          const storedAt = Date.now();
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_ASSET_BYTES) {
              response.destroy();
              resolve(null);
            } else chunks.push(chunk);
          });
          response.on("error", () => resolve(null));
          response.on("end", () => {
            if (!response.complete || size === 0) {
              resolve(null);
              return;
            }
            // Retain CORS/CORP/CSP and content headers; remove hop-by-hop headers.
            const hopHeaders = new Set([
              "connection",
              "keep-alive",
              "proxy-authenticate",
              "proxy-authorization",
              "te",
              "trailer",
              "transfer-encoding",
              "upgrade",
              ...(headers.connection || "")
                .toLowerCase()
                .split(",")
                .map((v) => v.trim()),
            ]);
            for (const key of hopHeaders) delete headers[key];
            delete headers["content-encoding"];
            headers["content-length"] = String(size);
            resolve({
              body: Buffer.concat(chunks, size),
              headers,
              expiresAt,
              storedAt,
            });
          });
        }
      );
      request.on("error", () => resolve(null));
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

type CacheOptions = {
  maxBytes?: number;
  maxEntries?: number;
  maxPending?: number;
  load?: typeof loadPublicRenderAsset;
  now?: () => number;
};

export class RenderAssetCache {
  private entries = new Map<string, CachedAsset>();
  private pending = new Map<string, Promise<CachedAsset | null>>();
  private bytes = 0;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private readonly maxPending: number;
  private readonly load: typeof loadPublicRenderAsset;
  private readonly now: () => number;
  constructor(options: CacheOptions = {}) {
    this.maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    this.maxEntries = options.maxEntries ?? 512;
    this.maxPending = options.maxPending ?? 16;
    this.load = options.load ?? loadPublicRenderAsset;
    this.now = options.now ?? Date.now;
  }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.body.length;
    this.entries.delete(key);
  }
  async get(
    request: AssetRequest,
    stats = createAssetCacheStats()
  ): Promise<CachedAsset | null> {
    const url = getCacheableAssetUrl(request);
    if (!url) {
      stats.bypasses++;
      return null;
    }
    const allowed = getAllowedPrivateRenderOrigins();
    // Development exceptions must never populate a production cache namespace.
    const key = JSON.stringify([[...allowed].sort(), url.href]);
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      stats.hits++;
      stats.bytesServed += hit.body.length;
      return hit;
    }
    this.remove(key);
    const pending = this.pending.get(key);
    if (pending) {
      stats.coalesced++;
      const result = await pending;
      if (result) stats.bytesServed += result.body.length;
      return result;
    }
    if (this.pending.size >= this.maxPending) {
      stats.bypasses++;
      return null;
    }
    stats.misses++;
    const work = Promise.resolve()
      .then(() => this.load(url, allowed))
      .then((result) => {
        if (
          !result ||
          result.expiresAt <= this.now() ||
          result.body.length > Math.min(MAX_ASSET_BYTES, this.maxBytes)
        )
          return null;
        for (const [oldKey, entry] of this.entries)
          if (entry.expiresAt <= this.now()) this.remove(oldKey);
        while (
          this.entries.size &&
          (this.entries.size >= this.maxEntries ||
            this.bytes + result.body.length > this.maxBytes)
        )
          this.remove(this.entries.keys().next().value!);
        this.entries.set(key, result);
        this.bytes += result.body.length;
        return result;
      })
      .catch(() => null)
      .finally(() => this.pending.delete(key));
    this.pending.set(key, work);
    const result = await work;
    if (result) stats.bytesServed += result.body.length;
    return result;
  }
}

export const renderAssetCache = new RenderAssetCache();
