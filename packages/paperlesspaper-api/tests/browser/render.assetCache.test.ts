import { afterAll, beforeAll, expect, it, vi } from "vitest";
import http from "node:http";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import renderService, {
  closeRenderBrowser,
} from "../../src/render/render.service";

let origin: string;
const counts = new Map<string, number>();
const storage: string[] = [];
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>';
const server = http.createServer((req, res) => {
  const url = new URL(req.url!, origin);
  counts.set(url.pathname, (counts.get(url.pathname) || 0) + 1);
  if (url.pathname.startsWith("/_next/static/")) {
    res.setHeader("Cache-Control", "public,max-age=3600,immutable");
    if (url.pathname.includes("/private/"))
      res.setHeader("Cache-Control", "private,no-store");
    if (url.pathname.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css");
      res.end(
        "body{background:white;color:navy;font-family:Arial} h1{font-size:24px}"
      );
    } else if (url.pathname.endsWith(".svg")) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(svg);
    } else {
      res.setHeader("Content-Type", "application/javascript");
      res.end('window.staticAsset="Cached public asset"');
    }
    return;
  }
  if (url.pathname === "/storage-report") {
    storage.push(url.searchParams.get("state")!);
    res.end("ok");
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/cookie-page")
    res.setHeader("Set-Cookie", "session=private; Path=/");
  const assetRoot =
    url.pathname === "/uncacheable-page"
      ? "/_next/static/private"
      : "/_next/static";
  res.end(`<!doctype html><link rel="stylesheet" href="${assetRoot}/cache-test.css"><script src="${assetRoot}/cache-test.js"></script><body>
    <div id="website-has-loading-element"></div><h1 id="title"></h1><img src="${assetRoot}/cache-test.svg">
    <script>window.addEventListener('message', async e => {
      if(e.data.type !== 'INIT') return;
      await fetch('/storage-report?state=' + encodeURIComponent(JSON.stringify({cookie:document.cookie, storage:localStorage.getItem('user')})));
      document.cookie='user=private'; localStorage.setItem('user','private');
      document.getElementById('title').textContent=window.staticAsset;
      await Promise.all([...document.images].map(i=>i.decode()));
      document.body.insertAdjacentHTML('beforeend','<div id="website-has-loaded"></div>');
    });</script></body>`);
});
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", origin);
  vi.stubEnv("PAPERLESSPAPER_APPS_URL", origin);
});
afterAll(async () => {
  await closeRenderBrowser();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  vi.unstubAllEnvs();
});
const pixels = async (buffer: Buffer) => {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return Buffer.from(ctx.getImageData(0, 0, image.width, image.height).data);
};

it.each(["portrait", "landscape"] as const)(
  "renders identical %s pixels with shared public assets and isolated sessions",
  async (orientation) => {
    const render = async (disabled: boolean) => {
      vi.stubEnv("RENDER_STATIC_CACHE_DISABLED", String(disabled));
      const result = await renderService.generateImageFromUrl({
        url: `${origin}/page`,
        kind: "epd7",
        orientation,
        paper: { kind: "plugin" },
        data: { settings: {} },
      });
      expect(result.diagnostics.outcome).toBe("success");
      expect(result.buffer).not.toBeNull();
      return result;
    };
    const direct = await render(true);
    await render(false);
    const before = new Map(counts);
    const cached = await render(false);
    expect(cached.diagnostics.assetCache.hits).toBe(3);
    expect(await pixels(cached.buffer!)).toEqual(await pixels(direct.buffer!));
    for (const name of ["css", "js", "svg"])
      expect(counts.get(`/_next/static/cache-test.${name}`)).toBe(
        before.get(`/_next/static/cache-test.${name}`)
      );
    expect(counts.get("/page")).toBe(before.get("/page")! + 1);
    expect(
      storage.every(
        (value) => value === JSON.stringify({ cookie: "", storage: null })
      )
    ).toBe(true);
  },
  30_000
);

it("bypasses already cached assets when the browser request carries a cookie", async () => {
  vi.stubEnv("RENDER_STATIC_CACHE_DISABLED", "false");
  const before = new Map(counts);
  const result = await renderService.generateImageFromUrl({
    url: `${origin}/cookie-page`,
    kind: "epd7",
    paper: { kind: "plugin" },
    data: { settings: {} },
  });
  expect(result.diagnostics.outcome).toBe("success");
  expect(result.diagnostics.assetCache.hits).toBe(0);
  expect(result.diagnostics.assetCache.misses).toBe(0);
  for (const name of ["css", "js", "svg"])
    expect(counts.get(`/_next/static/cache-test.${name}`)).toBe(
      before.get(`/_next/static/cache-test.${name}`)! + 1
    );
}, 30_000);

it("falls back to the filtered browser for non-public responses without caching them", async () => {
  vi.stubEnv("RENDER_STATIC_CACHE_DISABLED", "true");
  const options = {
    url: `${origin}/uncacheable-page`,
    kind: "epd7",
    paper: { kind: "plugin" },
    data: { settings: {} },
  };
  const direct = await renderService.generateImageFromUrl(options);
  vi.stubEnv("RENDER_STATIC_CACHE_DISABLED", "false");
  for (let i = 0; i < 2; i++) {
    const result = await renderService.generateImageFromUrl(options);
    expect(result.diagnostics.outcome).toBe("success");
    expect(result.diagnostics.assetCache.hits).toBe(0);
    expect(result.diagnostics.assetCache.misses).toBe(3);
    expect(await pixels(result.buffer!)).toEqual(await pixels(direct.buffer!));
  }
}, 30_000);
