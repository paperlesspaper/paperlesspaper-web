import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import puppeteer, { type Browser } from "puppeteer";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import renderService, {
  closeRenderBrowser,
  getBrowserLaunchOptions,
} from "../../src/render/render.service";
import { startRenderProxy } from "../../src/render/renderNetwork";

let origin: string;
let privateOrigin: string;
let privateHits = 0;
let browser: Browser;
let proxy: Awaited<ReturnType<typeof startRenderProxy>>;
let temporaryDirectory: string;
const storageReports: string[] = [];

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>';
const fixture = (legacy = false) => `<!doctype html><html><head>
  <meta name="paperless:epd-optimize" content='{"enabled":false}'>
  <link rel="stylesheet" href="/style.css">
  <script src="/script.js"></script>
  </head><body>
  ${legacy ? "" : '<div id="website-has-loading-element"></div>'}
  <h1 id="title">Waiting</h1><p id="timezone"></p><p id="legacy"></p>
  <img width="40" height="40" src="/image.svg">
  <img width="40" height="40" src="data:image/svg+xml,${encodeURIComponent(
    svg
  )}">
  <script>
    const blobImage = new Image(40, 40);
    blobImage.src = URL.createObjectURL(new Blob([${JSON.stringify(
      svg
    )}], {type:'image/svg+xml'}));
    document.body.append(blobImage);
    document.querySelector('#timezone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    window.addEventListener('message', async event => {
      if (event.data.type === 'GOOGLECALENDAR') document.querySelector('#legacy').textContent = event.data.data[0].summary;
      if (event.data.type !== 'INIT') return;
      document.querySelector('#title').textContent = event.data.data.settings?.headline || event.data.data.meta.headline;
      await Promise.all([...document.images].map(image => image.decode()));
      const ready = document.createElement('div'); ready.id = 'website-has-loaded'; document.body.append(ready);
      document.documentElement.dataset.paperlessRenderStatus = 'ready';
    });
  </script></body></html>`;

const privateServer = http.createServer((_, res) => {
  privateHits++;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end("PRIVATE_SENTINEL");
});
privateServer.on("upgrade", (_, socket) => {
  privateHits++;
  socket.destroy();
});

const fixtureServer = http.createServer((req, res) => {
  if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end("body{margin:0;background:white;font-family:Arial}h1{color:navy}");
  } else if (req.url === "/script.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end("window.scriptLoaded = true");
  } else if (req.url === "/image.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(svg);
  } else if (req.url === "/redirect-private") {
    res.writeHead(302, { Location: `${privateOrigin}/secret` });
    res.end();
  } else if (req.url === "/redirect-safe") {
    res.writeHead(302, { Location: `${origin}/plugin` });
    res.end();
  } else if (req.url === "/redirect-file") {
    res.writeHead(302, {
      Location: `file://${temporaryDirectory}/sentinel.html`,
    });
    res.end();
  } else if (req.url === "/worker.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(
      `fetch('${privateOrigin}/worker').then(()=>postMessage('finished'),()=>postMessage('blocked'));`
    );
  } else if (req.url === "/storage") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<body><script>document.body.textContent = localStorage.getItem("secret") || "clean"</script></body>'
    );
  } else if (req.url?.startsWith("/report?")) {
    storageReports.push(
      new URL(req.url, origin).searchParams.get("state") || ""
    );
    res.end("ok");
  } else if (req.url === "/job-storage") {
    res.setHeader("Content-Type", "text/html");
    res.end(`<body><div id="website-has-loading-element"></div><script>
      window.addEventListener('message', async event => {
        if(event.data.type !== 'INIT') return;
        await fetch('/report?state=' + encodeURIComponent(JSON.stringify({storage: localStorage.getItem('secret'), cookie: document.cookie})));
        localStorage.setItem('secret', 'previous-user'); document.cookie = 'secret=previous-user';
        window.open('/storage');
        document.body.innerHTML = '<div id="website-has-loaded">ready</div>';
      });
    </script></body>`);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(fixture(req.url === "/legacy"));
  }
});
fixtureServer.on("upgrade", (req, socket) => {
  const accept = createHash("sha1")
    .update(
      `${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`
    )
    .digest("base64");
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.write(Buffer.from([0x81, 2, 0x6f, 0x6b]));
  socket.on("data", () => socket.end());
  socket.on("error", () => socket.destroy());
});

const listen = async (server: http.Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture did not bind");
  return `http://127.0.0.1:${address.port}`;
};

const pixels = async (buffer: Buffer) => {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: Buffer.from(ctx.getImageData(0, 0, image.width, image.height).data),
  };
};

beforeAll(async () => {
  temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "render-security-")
  );
  await fs.writeFile(
    path.join(temporaryDirectory, "sentinel.html"),
    "<body>PRIVATE_FILE_SENTINEL</body>"
  );
  privateOrigin = await listen(privateServer);
  origin = await listen(fixtureServer);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", origin);
  vi.stubEnv("PAPERLESSPAPER_APPS_URL", origin);
  proxy = await startRenderProxy();
  browser = await puppeteer.launch(getBrowserLaunchOptions());
}, 30_000);

afterAll(async () => {
  await closeRenderBrowser();
  await browser?.close();
  await proxy?.close();
  for (const server of [fixtureServer, privateServer]) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (temporaryDirectory)
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("real Chromium render regressions", () => {
  it("still renders ordinary websites without readiness markers", async () => {
    const result = await renderService.generateImageFromUrl({
      url: `${origin}/storage`,
      kind: "epd7",
    });
    expect(result.diagnostics.outcome).toBe("success");
    expect(result.diagnostics.readiness.outcome).toBe("legacy-delay");
    expect(result.buffer).not.toBeNull();
  }, 15_000);

  it("preserves allowed WebSocket connections", async () => {
    const context = await browser.createBrowserContext({
      proxyServer: proxy.url,
      proxyBypassList: ["<-loopback>"],
    });
    try {
      const page = await context.newPage();
      await page.goto(`${origin}/storage`);
      const message = await page.evaluate(
        (target) =>
          new Promise<string>((resolve, reject) => {
            const socket = new WebSocket(
              target.replace("http:", "ws:") + "/socket"
            );
            socket.onmessage = (event) => {
              resolve(event.data);
              socket.close();
            };
            socket.onerror = () => reject(new Error("WebSocket failed"));
          }),
        origin
      );
      expect(message).toBe("ok");
    } finally {
      await context.close();
    }
  });
  it.each(["portrait", "landscape"] as const)(
    "produces pixel-identical plugin output in %s with JS, CSS, images, INIT and timezone",
    async (orientation) => {
      const data = { settings: { headline: "Render regression fixture" } };
      const result = await renderService.generateImageFromUrl({
        url: "https://apps.paperlesspaper.de/plugin",
        kind: "epd7",
        orientation,
        paper: { kind: "plugin" },
        data,
        css: "h1{color:rgb(90,20,30)}",
        timezone: "Europe/Berlin",
      });
      expect(
        result.diagnostics.outcome,
        JSON.stringify(result.diagnostics)
      ).toBe("success");
      expect(result.diagnostics.readiness.outcome).toBe("website-has-loaded");
      expect(result.epdOptimizeSettings?.enabled).toBe(false);
      expect(result.buffer).not.toBeNull();

      // Trusted fixture only: reference output without the new proxy/security hooks.
      const reference = await browser.createBrowserContext({
        proxyServer: "direct://",
      });
      try {
        const page = await reference.newPage();
        await page.setViewport({
          width: result.size.width,
          height: result.size.height,
          deviceScaleFactor: 1,
        });
        await page.emulateTimezone("Europe/Berlin");
        await page.goto(`${origin}/plugin`, { waitUntil: "networkidle0" });
        expect(await page.evaluate(() => (window as any).scriptLoaded)).toBe(
          true
        );
        await page.evaluate(
          (payload) => window.postMessage({ type: "INIT", data: payload }, "*"),
          data
        );
        await page.waitForSelector("#website-has-loaded");
        await page.addStyleTag({ content: "h1{color:rgb(90,20,30)}" });
        const expected = await pixels(Buffer.from(await page.screenshot()));
        const actual = await pixels(result.buffer!);
        expect([actual.width, actual.height]).toEqual([
          expected.width,
          expected.height,
        ]);
        expect(actual.data.equals(expected.data)).toBe(true);
      } finally {
        await reference.close();
      }
    },
    30_000
  );

  it("preserves legacy calendar messages and regular redirects", async () => {
    const result = await renderService.generateImageFromUrl({
      url: `${origin}/legacy`,
      kind: "epd7",
      paper: { kind: "google-calendar", meta: { headline: "Calendar" } },
      data: [{ summary: "Calendar event" }],
    });
    expect(result.diagnostics.outcome).toBe("success");
    expect(result.diagnostics.legacyDataPayloadSent).toBe(true);
    expect(result.diagnostics.initPayloadSent).toBe(true);
    const redirect = await renderService.generateImageFromUrl({
      url: `${origin}/redirect-safe`,
      kind: "epd7",
      paper: { kind: "plugin" },
      data: { settings: { headline: "Redirect" } },
    });
    expect(redirect.diagnostics.outcome).toBe("success");
  }, 30_000);

  it.runIf(process.env.RENDER_LIVE_SMOKE === "true")(
    "renders public HTTPS through CONNECT with certificate validation",
    async () => {
      const context = await browser.createBrowserContext({
        proxyServer: proxy.url,
        proxyBypassList: ["<-loopback>"],
      });
      try {
        const page = await context.newPage();
        const response = await page.goto("https://example.com", {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });
        expect(response?.status()).toBe(200);
        expect(await page.title()).toBe("Example Domain");
      } finally {
        await context.close();
      }
    },
    20_000
  );

  it.runIf(process.env.RENDER_LIVE_SMOKE === "true")(
    "renders the public paperlesspaper calendar integration",
    async () => {
      vi.stubEnv("PAPERLESSPAPER_APPS_URL", "https://apps.paperlesspaper.de");
      try {
        const result = await renderService.generateImageFromUrl({
          url: "https://apps.paperlesspaper.de/calendar",
          kind: "epd7",
          paper: {
            kind: "calendar",
            meta: { language: "de", orientation: "portrait" },
          },
          timezone: "Europe/Berlin",
        });
        expect(
          result.diagnostics.outcome,
          JSON.stringify(result.diagnostics)
        ).toBe("success");
        expect(result.diagnostics.pageState.status).not.toBe("error");
        expect(result.buffer!.length).toBeGreaterThan(1_000);
      } finally {
        vi.stubEnv("PAPERLESSPAPER_APPS_URL", origin);
      }
    },
    30_000
  );
});

describe("real Chromium security boundaries", () => {
  it("discards storage and cookies between actual render-service jobs", async () => {
    storageReports.length = 0;
    for (let job = 0; job < 2; job++) {
      const result = await renderService.generateImageFromUrl({
        url: `${origin}/job-storage`,
        kind: "epd7",
        paper: { kind: "plugin" },
      });
      expect(result.diagnostics.outcome).toBe("success");
    }
    expect(storageReports.map((value) => JSON.parse(value))).toEqual([
      { storage: null, cookie: "" },
      { storage: null, cookie: "" },
    ]);
  });
  it("blocks direct private URLs, alternate loopback spelling, redirects and local files", async () => {
    privateHits = 0;
    for (const url of [
      privateOrigin,
      privateOrigin.replace("127.0.0.1", "2130706433"),
      `${origin}/redirect-private`,
      `${origin}/redirect-file`,
      `file://${temporaryDirectory}/sentinel.html`,
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:3000/",
    ]) {
      const result = await renderService.generateImageFromUrl({
        url,
        kind: "epd7",
      });
      expect(result.buffer, url).toBeNull();
      expect(result.diagnostics.outcome, url).toBe("error");
    }
    expect(privateHits).toBe(0);
  }, 30_000);

  it("blocks private fetches, images, CSS, frames, workers, WebSockets and popups", async () => {
    privateHits = 0;
    const context = await browser.createBrowserContext({
      proxyServer: proxy.url,
      proxyBypassList: ["<-loopback>"],
    });
    try {
      const page = await context.newPage();
      await page.goto(`${origin}/plugin`);
      await page.evaluate(async (target) => {
        const image = new Image();
        image.src = `${target}/image`;
        document.body.append(image);
        const frame = document.createElement("iframe");
        frame.src = `${target}/frame`;
        document.body.append(frame);
        const style = document.createElement("style");
        style.textContent = `@import url('${target}/css'); body{background-image:url('${target}/background')}`;
        document.head.append(style);
        const ws = new WebSocket(target.replace("http:", "ws:") + "/ws");
        const wss = new WebSocket(target.replace("http:", "wss:") + "/wss");
        const worker = new Worker("/worker.js");
        window.open(`${target}/popup`);
        await Promise.allSettled([
          fetch(`${target}/fetch`),
          fetch(target.replace("http:", "https:") + "/tls"),
          new Promise((resolve) => {
            ws.onerror = resolve;
          }),
          new Promise((resolve) => {
            wss.onerror = resolve;
          }),
          new Promise((resolve) => {
            worker.onmessage = resolve;
          }),
        ]);
        worker.terminate();
        ws.close();
        wss.close();
      }, privateOrigin);
      await page.waitForNetworkIdle({ timeout: 5_000 });
      expect(privateHits).toBe(0);
    } finally {
      await context.close();
    }
  }, 20_000);

  it("isolates cookies/localStorage between contexts and closes popups with their job", async () => {
    const first = await browser.createBrowserContext({
      proxyServer: proxy.url,
      proxyBypassList: ["<-loopback>"],
    });
    const firstPage = await first.newPage();
    await firstPage.goto(`${origin}/storage`);
    await firstPage.evaluate(() => {
      localStorage.setItem("secret", "other-user-data");
      document.cookie = "secret=other-user-data";
      window.open("/storage");
    });
    const second = await browser.createBrowserContext({
      proxyServer: proxy.url,
      proxyBypassList: ["<-loopback>"],
    });
    try {
      const secondPage = await second.newPage();
      await secondPage.goto(`${origin}/storage`);
      expect(await secondPage.evaluate(() => document.body.textContent)).toBe(
        "clean"
      );
      expect(await secondPage.evaluate(() => document.cookie)).toBe("");
    } finally {
      await first.close();
      await second.close();
    }
    expect(browser.browserContexts()).toHaveLength(1);
  });
});
