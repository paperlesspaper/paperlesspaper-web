import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import {
  assetFreshnessMs,
  createAssetCacheStats,
  getCacheableAssetUrl,
  loadPublicRenderAsset,
  RenderAssetCache,
  type AssetRequest,
} from "../../src/render/renderAssetCache";

afterEach(() => vi.unstubAllEnvs());
const request = (file = "chunk.js"): AssetRequest => ({
  url: `https://apps.paperlesspaper.de/_next/static/chunks/${file}`,
  method: "GET",
  resourceType: "script",
  headers: {},
});
const publicHeaders = {
  "cache-control": "public,max-age=3600,immutable",
  "content-type": "application/javascript",
};

describe("shared render asset policy", () => {
  it("accepts only explicitly selected static resources", () => {
    expect(getCacheableAssetUrl(request())?.pathname).toContain(
      "/_next/static/"
    );
  });
  it.each([
    "https://evil.example/_next/static/a.js",
    "https://apps.paperlesspaper.de.evil.example/_next/static/a.js",
    "http://apps.paperlesspaper.de/_next/static/a.js",
    "https://user:password@apps.paperlesspaper.de/_next/static/a.js",
    "https://apps.paperlesspaper.de/_next/static/a.js?token=secret",
    "https://apps.paperlesspaper.de/_next/static/a.js#fragment",
    "https://apps.paperlesspaper.de/api/calendar.js",
    "https://apps.paperlesspaper.de/_next/static/../api/a.js",
    "https://apps.paperlesspaper.de/_next/static/%2e%2e/api/a.js",
    "https://apps.paperlesspaper.de/_next/static/a.json",
    "https://apps.paperlesspaper.de/_next/static/a.html",
  ])("bypasses %s", (url) =>
    expect(getCacheableAssetUrl({ ...request(), url })).toBeNull()
  );
  it.each([
    "cookie",
    "Cookie",
    "authorization",
    "proxy-authorization",
    "range",
    "if-none-match",
    "if-modified-since",
    "cache-control",
    "pragma",
  ])("bypasses request header %s", (key) => {
    expect(
      getCacheableAssetUrl({ ...request(), headers: { [key]: "value" } })
    ).toBeNull();
  });
  it.each(["document", "fetch", "xhr", "other"])(
    "bypasses resource type %s",
    (resourceType) =>
      expect(getCacheableAssetUrl({ ...request(), resourceType })).toBeNull()
  );
  it("bypasses POST and the operational disable switch", () => {
    expect(getCacheableAssetUrl({ ...request(), method: "POST" })).toBeNull();
    vi.stubEnv("RENDER_STATIC_CACHE_DISABLED", "true");
    expect(getCacheableAssetUrl(request())).toBeNull();
  });
  it.each([
    "public,max-age=600",
    "private,max-age=600,immutable",
    "public,no-store,max-age=600,immutable",
    "public,no-cache,max-age=600,immutable",
    "public,max-age=0,immutable",
    "public,max-age=600,s-maxage=0,immutable",
    "public,max-age=600,max-age=900,immutable",
    "public,max-age=garbage,immutable",
  ])("rejects cache-control %s", (value) =>
    expect(assetFreshnessMs({ ...publicHeaders, "cache-control": value })).toBe(
      0
    )
  );
  it.each([
    { "set-cookie": "session=secret" },
    { vary: "Cookie" },
    { vary: "Origin" },
    { vary: "*" },
    { "content-encoding": "gzip" },
    { "content-range": "bytes 0-100/200" },
    { age: "NaN" },
    { date: "invalid" },
  ])("rejects unsafe response headers %j", (extra) =>
    expect(
      assetFreshnessMs({ ...publicHeaders, ...extra } as Record<string, string>)
    ).toBe(0)
  );
  it("honors age, date, s-maxage and the one-hour cap", () => {
    expect(
      assetFreshnessMs({
        ...publicHeaders,
        age: "3500",
        vary: "Accept-Encoding",
      })
    ).toBe(100_000);
    expect(assetFreshnessMs({ ...publicHeaders, age: "3601" })).toBe(0);
    expect(
      assetFreshnessMs(
        { ...publicHeaders, date: new Date(0).toUTCString() },
        3_500_000
      )
    ).toBe(100_000);
    expect(
      assetFreshnessMs({ "cache-control": "public,max-age=31536000,immutable" })
    ).toBe(3_600_000);
    expect(
      assetFreshnessMs({
        "cache-control": "public,max-age=600,s-maxage=60,immutable",
      })
    ).toBe(60_000);
  });
});

describe("bounded shared cache", () => {
  const asset = () => ({
    body: Buffer.from("test"),
    headers: publicHeaders,
    expiresAt: 1000,
    storedAt: 0,
  });
  it("shares one anonymous download across concurrent jobs, then serves hits", async () => {
    const load = vi.fn(async () => asset());
    const cache = new RenderAssetCache({ load, now: () => 0 });
    const stats = createAssetCacheStats();
    await Promise.all([
      cache.get(request(), stats),
      cache.get(request(), stats),
    ]);
    await cache.get(request(), stats);
    expect(load).toHaveBeenCalledTimes(1);
    expect(stats).toMatchObject({
      misses: 1,
      hits: 1,
      coalesced: 1,
      bytesServed: 12,
    });
  });
  it("expires entries and evicts least-recently-used bytes", async () => {
    let now = 0;
    const load = vi.fn(async () => asset());
    const cache = new RenderAssetCache({ load, now: () => now, maxBytes: 8 });
    await cache.get(request("a.js"));
    await cache.get(request("b.js"));
    await cache.get(request("a.js"));
    await cache.get(request("c.js"));
    await cache.get(request("b.js"));
    expect(load).toHaveBeenCalledTimes(4);
    now = 1001;
    await cache.get(request("b.js"));
    expect(load).toHaveBeenCalledTimes(5);
  });
  it("bounds entry count, pending downloads and oversized entries", async () => {
    const load = vi.fn(async () => asset());
    const cache = new RenderAssetCache({ load, now: () => 0, maxEntries: 1 });
    await cache.get(request("a.js"));
    await cache.get(request("b.js"));
    await cache.get(request("a.js"));
    expect(load).toHaveBeenCalledTimes(3);
    const tiny = new RenderAssetCache({ load, now: () => 0, maxBytes: 3 });
    expect(await tiny.get(request())).toBeNull();
    const limited = new RenderAssetCache({ load, now: () => 0, maxPending: 1 });
    const first = limited.get(request("a.js"));
    expect(await limited.get(request("b.js"))).toBeNull();
    await first;
  });
  it("isolates development exception policies and falls back on loader errors", async () => {
    const load = vi.fn(async () => asset());
    const cache = new RenderAssetCache({ load, now: () => 0 });
    await cache.get(request());
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", "http://127.0.0.1:12345");
    await cache.get(request());
    expect(load).toHaveBeenCalledTimes(2);
    const failed = new RenderAssetCache({
      load: async () => {
        throw new Error("network");
      },
    });
    expect(await failed.get(request())).toBeNull();
  });
});

it("fetches bounded anonymous bodies, refuses redirects/private IPs and unsafe responses", async () => {
  const seen: http.IncomingHttpHeaders[] = [];
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    seen.push(req.headers);
    if (req.url === "/redirect.js") {
      res.writeHead(302, { location: "/good.js" });
      res.end();
      return;
    }
    res.writeHead(200, {
      ...publicHeaders,
      ...(req.url === "/private.js" ? { "set-cookie": "secret=value" } : {}),
      ...(req.url === "/wrong.js" ? { "content-type": "text/html" } : {}),
    });
    res.end(
      req.url === "/huge.js"
        ? Buffer.alloc(2 * 1024 * 1024 + 1)
        : "window.publicAsset=true;"
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const allowed = new Set([origin]);
  try {
    expect(
      await loadPublicRenderAsset(new URL(`${origin}/good.js`), new Set())
    ).toBeNull();
    expect(hits).toBe(0);
    const good = await loadPublicRenderAsset(
      new URL(`${origin}/good.js`),
      allowed
    );
    expect(good?.body.toString()).toBe("window.publicAsset=true;");
    expect(good?.headers["transfer-encoding"]).toBeUndefined();
    expect(good?.headers["content-length"]).toBe("24");
    const before = hits;
    expect(
      await loadPublicRenderAsset(new URL(`${origin}/redirect.js`), allowed)
    ).toBeNull();
    expect(hits).toBe(before + 1);
    for (const name of ["private", "huge", "wrong"])
      expect(
        await loadPublicRenderAsset(new URL(`${origin}/${name}.js`), allowed)
      ).toBeNull();
    expect(
      seen.every(
        (h) =>
          !h.cookie &&
          !h.authorization &&
          !h.referer &&
          h["accept-encoding"] === "identity"
      )
    ).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
