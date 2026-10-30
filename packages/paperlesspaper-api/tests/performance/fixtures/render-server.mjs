import http from "node:http";
import fs from "node:fs";

const png = fs.readFileSync(process.argv[2]);
const counters = new Map();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://fixture");
  if (url.pathname === "/stats") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(Object.fromEntries(counters)));
  }
  if (url.pathname.startsWith("/_next/static/")) {
    const [, group, version, latency] =
      url.pathname.match(/^\/_next\/static\/([^/]+)\/([^/]+)\/([^/]+)\//) || [];
    url.searchParams.set("group", group);
    url.searchParams.set("version", version);
    url.searchParams.set("latency", latency);
  }
  if (
    url.pathname.startsWith("/asset/") ||
    url.pathname.startsWith("/_next/static/")
  ) {
    const key = url.searchParams.get("group");
    const previous = counters.get(key) || { requests: 0, bytes: 0 };
    let body, type;
    if (url.pathname.endsWith(".png")) {
      body = png;
      type = "image/png";
    } else if (url.pathname.endsWith(".js")) {
      body = Buffer.from(
        `window.benchmarkAssets=(window.benchmarkAssets||0)+1;/*${"x".repeat(
          64 * 1024
        )}*/`
      );
      type = "application/javascript";
    } else {
      body = Buffer.from(
        `body{margin:0;background:white;color:black;font-family:Arial} img{width:100px;height:100px}/*${"x".repeat(
          32 * 1024
        )}*/`
      );
      type = "text/css";
    }
    counters.set(key, {
      requests: previous.requests + 1,
      bytes: previous.bytes + body.length,
    });
    res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", body.length);
    return setTimeout(
      () => res.end(body),
      Number(url.searchParams.get("latency") || 0)
    );
  }
  const heavy = url.searchParams.get("heavy") === "1";
  const query = new URLSearchParams({
    group: url.searchParams.get("group") || "unknown",
    latency: url.searchParams.get("latency") || "0",
    version: url.searchParams.get("version") || "cached",
  });
  const asset = (file) =>
    process.env.RENDER_BENCHMARK_COMPARE_CACHE === "true"
      ? `/_next/static/${query.get("group")}/${query.get(
          "version"
        )}/${query.get("latency")}/${file}`
      : `/asset/${file}?${query}`;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html");
  res.end(`<!doctype html><html><head>
    ${Array.from(
      { length: heavy ? 2 : 1 },
      (_, i) => `<link rel="stylesheet" href="${asset(`${i}.css`)}">`
    ).join("")}
    ${Array.from(
      { length: heavy ? 4 : 0 },
      (_, i) => `<script src="${asset(`${i}.js`)}" defer></script>`
    ).join("")}
    </head><body><div id="website-has-loading-element"></div><h1>Rendering benchmark</h1>
    ${Array.from(
      { length: heavy ? 16 : 1 },
      (_, i) => `<img src="${asset(`${i}.png`)}">`
    ).join("")}
    <script>window.addEventListener('message', async event => {
      if(event.data.type !== 'INIT') return;
      await Promise.all([...document.images].map(i => i.decode()));
      document.body.insertAdjacentHTML('beforeend','<div id="website-has-loaded"></div>');
      document.documentElement.dataset.paperlessRenderStatus='ready';
    });</script></body></html>`);
});
server.listen(0, "127.0.0.1", () =>
  process.stdout.write(`${server.address().port}\n`)
);
process.once("SIGTERM", () => {
  server.closeAllConnections();
  server.close(() => process.exit(0));
});
