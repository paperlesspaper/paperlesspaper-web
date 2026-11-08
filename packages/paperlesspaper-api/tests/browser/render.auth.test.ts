import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  generateImageFromUrl,
  closeRenderBrowser,
} from "../../src/render/render.browser";
import { createRenderServer } from "../../src/render/renderServer";
import { requestRender } from "../../src/render/renderClient";
import { renderAssetCache } from "../../src/render/renderAssetCache";

const password = "p@ss:word%+";
const authorization = `Basic ${Buffer.from(`user:${password}`).toString(
  "base64"
)}`;
const hits: Array<{ url: string; authorization?: string }> = [];
const foreignHits: Array<{ url: string; authorization?: string }> = [];
let privateHits = 0;
let origin: string;
let foreignOrigin: string;
let privateOrigin: string;
let directory: string;
let socket: string;
const ready = '<div id="website-has-loaded">Ready</div>';
const foreignServer = http.createServer((req, res) => {
  foreignHits.push({ url: req.url!, authorization: req.headers.authorization });
  if (req.url === "/challenge") {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="other-site"' });
    res.end("Unauthorized");
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(ready);
  }
});
const privateServer = http.createServer((_, res) => {
  privateHits++;
  res.end(ready);
});
const fixture = http.createServer((req, res) => {
  hits.push({ url: req.url!, authorization: req.headers.authorization });
  if (req.headers.authorization !== authorization) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="calendar"' });
    res.end("Unauthorized");
    return;
  }
  if (req.url === "/same-origin") {
    res.writeHead(302, { Location: "/calendar" });
    res.end();
  } else if (
    req.url === "/foreign" ||
    req.url === "/challenge" ||
    req.url === "/private"
  ) {
    res.writeHead(302, {
      Location:
        req.url === "/private"
          ? `${privateOrigin}/secret`
          : `${foreignOrigin}${req.url}`,
    });
    res.end();
  } else if (req.url === "/_next/static/protected.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public,max-age=3600,immutable");
    res.end("window.protectedScriptLoaded = true;");
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(`<script src="/_next/static/protected.js"></script>
      <div id="website-has-loading-element"></div><script>
      window.addEventListener('message', async event => {
        if (event.data.type !== 'INIT') return;
        const response = await fetch('/data');
        await fetch('${foreignOrigin}/asset', { mode: 'no-cors' });
        if (response.ok && window.protectedScriptLoaded) document.body.innerHTML = ${JSON.stringify(
          ready
        )};
      });
    </script>`);
  }
});
const renderer = createRenderServer(generateImageFromUrl, async () => {});
async function listen(server: http.Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
const authUrl = (path: string, secret = password) => {
  const url = new URL(path, origin);
  url.username = "user";
  url.password = encodeURIComponent(secret);
  return url.href;
};
beforeAll(async () => {
  origin = await listen(fixture);
  foreignOrigin = await listen(foreignServer);
  privateOrigin = await listen(privateServer);
  directory = await mkdtemp(`${tmpdir()}/auth-render-`);
  socket = `${directory}/s`;
  await new Promise<void>((resolve) => renderer.listen(socket, resolve));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", `${origin},${foreignOrigin}`);
  // Make the protected script otherwise eligible for the shared public cache.
  vi.stubEnv("PAPERLESSPAPER_APPS_URL", origin);
});
beforeEach(() => {
  hits.length = 0;
  foreignHits.length = 0;
  privateHits = 0;
});
afterAll(async () => {
  await closeRenderBrowser();
  for (const server of [fixture, foreignServer, privateServer, renderer]) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (directory) await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it("renders authenticated pages, same-origin redirects, scripts and fetches through the socket", async () => {
  const cache = vi.spyOn(renderAssetCache, "get");
  try {
    const result = await requestRender(
      {
        url: authUrl("/same-origin"),
        kind: "epd7",
        paper: { kind: "website" },
      },
      socket
    );
    expect(
      result.diagnostics.outcome,
      JSON.stringify(result.diagnostics.error)
    ).toBe("success");
    expect(result.buffer).not.toBeNull();
    expect(result.diagnostics.readiness.outcome).toBe("website-has-loaded");
    expect(hits.map((hit) => hit.url)).toEqual(
      expect.arrayContaining([
        "/same-origin",
        "/calendar",
        "/_next/static/protected.js",
        "/data",
      ])
    );
    expect(hits.every((hit) => hit.authorization === authorization)).toBe(true);
    expect(foreignHits).toContainEqual({
      url: "/asset",
      authorization: undefined,
    });
    expect(cache).not.toHaveBeenCalled();
    expect(JSON.stringify(result.diagnostics)).not.toContain(password);
    expect(JSON.stringify(result.diagnostics)).not.toContain(
      encodeURIComponent(password)
    );
    expect(JSON.stringify(result.diagnostics)).not.toContain(authorization);
  } finally {
    cache.mockRestore();
  }
}, 30_000);

it.each(["/foreign", "/challenge"])(
  "does not forward credentials on a cross-origin redirect to %s",
  async (path) => {
    const result = await requestRender(
      {
        url: authUrl(path),
        kind: "epd7",
        paper: { kind: "website", meta: { url: authUrl(path) } },
        data: { privateContent: "calendar" },
      },
      socket
    );
    expect(foreignHits.length).toBeGreaterThan(0);
    expect(foreignHits.every((hit) => hit.authorization === undefined)).toBe(
      true
    );
    expect(result.diagnostics.initPayloadSent).toBe(false);
    expect(result.diagnostics.legacyDataPayloadSent).toBe(false);
    expect(result.diagnostics.outcome).toBe(
      path === "/foreign" ? "success" : "error"
    );
  },
  30_000
);

it("rejects wrong credentials and does not reuse authentication in the next job", async () => {
  for (const url of [authUrl("/calendar", "incorrect"), `${origin}/calendar`]) {
    const result = await requestRender({ url, kind: "epd7" }, socket);
    expect(result.buffer).toBeNull();
    expect(result.diagnostics.outcome).toBe("error");
  }
  expect(hits.at(-1)?.authorization).toBeUndefined();
}, 30_000);

it("keeps private-network destinations blocked with Basic Auth", async () => {
  const result = await requestRender(
    { url: authUrl("/private"), kind: "epd7" },
    socket
  );
  expect(result.diagnostics.outcome).toBe("error");
  expect(privateHits).toBe(0);
}, 30_000);

it("does not expose credentials in diagnostics or logs for malformed URLs", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await generateImageFromUrl({
      url: "https://user:private-secret@[",
      kind: "epd7",
    });
    expect(result.diagnostics.outcome).toBe("error");
    expect(result.diagnostics.url).toBe("[invalid URL]");
    expect(JSON.stringify([result.diagnostics, log.mock.calls])).not.toContain(
      "private-secret"
    );
  } finally {
    log.mockRestore();
  }
});
