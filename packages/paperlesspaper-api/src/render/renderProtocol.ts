import type { GenerateImageOptions, RenderResult } from "./render.types";

export const MAX_RENDER_REQUEST_BYTES = 16 * 1024 * 1024;
export const MAX_RENDER_RESPONSE_BYTES = 24 * 1024 * 1024;
export const RENDER_DEADLINE_MS = 60_000;

export function parseRenderRequest(value: unknown): GenerateImageOptions {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid render request");
  const v = value as Record<string, unknown>;
  if (typeof v.url !== "string" || v.url.length > 8192)
    throw new Error("Invalid render URL");
  const url = new URL(v.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Invalid render URL");
  if (
    v.kind !== undefined &&
    (typeof v.kind !== "string" || v.kind.length > 100)
  )
    throw new Error("Invalid device kind");
  if (
    v.orientation !== undefined &&
    !["portrait", "landscape"].includes(v.orientation as string)
  )
    throw new Error("Invalid orientation");
  if (
    v.scroll !== undefined &&
    (typeof v.scroll !== "number" ||
      !Number.isFinite(v.scroll) ||
      Math.abs(v.scroll) > 1_000_000)
  )
    throw new Error("Invalid scroll position");
  if (
    v.css !== undefined &&
    (typeof v.css !== "string" || v.css.length > 1_000_000)
  )
    throw new Error("Invalid CSS");
  if (
    v.timezone !== undefined &&
    (typeof v.timezone !== "string" || v.timezone.length > 100)
  )
    throw new Error("Invalid timezone");
  // Deliberately omit the API's authentication token and all unknown top-level fields.
  return {
    url: v.url,
    kind: (v.kind as string) || "epd7",
    orientation: v.orientation as GenerateImageOptions["orientation"],
    scroll: v.scroll as number | undefined,
    css: v.css as string | undefined,
    timezone: v.timezone as string | undefined,
    data: v.data,
    paper: v.paper,
  };
}

export function decodeRenderResult(value: unknown): RenderResult {
  const v = value as any;
  if (
    v?.version !== 1 ||
    !v.result ||
    !(v.result.buffer === null || typeof v.result.buffer === "string")
  )
    throw new Error("Invalid renderer response");
  const r = v.result;
  if (
    !Number.isInteger(r.size?.width) ||
    !Number.isInteger(r.size?.height) ||
    r.size.width < 1 ||
    r.size.height < 1 ||
    r.size.width > 4096 ||
    r.size.height > 4096 ||
    !["portrait", "landscape"].includes(r.size.name) ||
    !["success", "error"].includes(r.diagnostics?.outcome) ||
    (r.diagnostics.outcome === "success" && !r.buffer)
  )
    throw new Error("Invalid renderer result");
  return {
    ...r,
    buffer: r.buffer === null ? null : Buffer.from(r.buffer, "base64"),
  };
}
