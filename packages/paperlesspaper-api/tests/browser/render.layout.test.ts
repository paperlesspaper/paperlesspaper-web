import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import {
  generateImageFromUrl,
  closeRenderBrowser,
} from "../../src/render/render.browser";
import { decodeRenderResult } from "../../src/render/renderProtocol";
import renderService from "../../src/render/render.service";
import { loadImage } from "@napi-rs/canvas";
let origin: string;
let childOrigin: string;
const child = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(`<meta name="paperless:epd-optimize" content='{"intent":"readable"}'><div id="website-has-loading-element"></div><script>
    addEventListener('message',event=>{if(event.data.type!=='INIT')return;setTimeout(()=>{
      document.body.style.background=event.data.data.color;
      document.documentElement.dataset.paperlessRenderStatus=${JSON.stringify(
        req.url === "/fail" ? "error" : "ready"
      )};
      document.getElementById('website-has-loading-element').id='website-has-loaded';
    },60);});
  </script>`);
});
const fixture = createServer((req, res) => {
  if (req.url === "/redirect") {
    res.writeHead(302, { Location: childOrigin });
    res.end();
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(`<style>body{margin:0;display:flex}iframe{border:0;width:400px;height:480px}</style><div id="website-has-loading-element" hidden></div><script>
    let ready=0;
    const slots = new Map();
    addEventListener('message',event=>{
      if(event.data.type==='INIT' && event.source===window){
        for(const [id,color] of [['left','red'],['right','blue']]){
          const frame=document.createElement('iframe');frame.name='paperless-slot:'+JSON.stringify({renderId:'r1',regionId:id,parentOrigin:location.origin});
          frame.src=${JSON.stringify(
            childOrigin
          )}+(event.data.data.fail && id==='right'?'/fail':'/ok');slots.set(id,{frame,color});document.body.append(frame);
        }
      }
      const slot=slots.get(event.data.regionId);
      if(!slot || event.source!==slot.frame.contentWindow || event.origin!==${JSON.stringify(
        childOrigin
      )})return;
      if(event.data.type==='PAPERLESS_RENDER_HELLO')slot.frame.contentWindow.postMessage({type:'INIT',renderId:'r1',regionId:event.data.regionId,data:{color:slot.color}},event.origin);
      if(event.data.type==='PAPERLESS_RENDER_STATUS'){
        if(event.data.status==='error'){document.documentElement.dataset.paperlessRenderStatus='error';document.getElementById('website-has-loading-element').id='website-has-loaded';return;}
        if(event.data.status==='ready' && ++ready===2){
          const meta=document.createElement('meta');meta.name='paperless:regions';meta.content=JSON.stringify([{id:'left',x:0,y:0,width:400,height:480,processing:'{"enabled":false}'},{id:'right',x:400,y:0,width:400,height:480,processing:'{"enabled":false}'}]);document.head.append(meta);
          document.documentElement.dataset.paperlessRenderStatus='ready';document.getElementById('website-has-loading-element').id='website-has-loaded';
        }
      }
    });
  </script>`);
});
const listen = (server: Server) =>
  new Promise<string>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${(server.address() as any).port}`)
    )
  );
beforeAll(async () => {
  childOrigin = await listen(child);
  origin = await listen(fixture);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", `${origin},${childOrigin}`);
});
afterAll(async () => {
  await closeRenderBrowser();
  for (const server of [fixture, child]) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  vi.unstubAllEnvs();
});
it("bridges cross-origin legacy readiness, transports regions and rotates the composed frame", async () => {
  const result = await generateImageFromUrl({
    url: origin,
    kind: "epd7",
    orientation: "landscape",
    paper: { kind: "layout" },
    data: { layout: { renderId: "r1" } },
  });
  expect(result.diagnostics.outcome).toBe("success");
  expect(result.regions).toHaveLength(2);
  const transported = decodeRenderResult({
    version: 1,
    result: { ...result, buffer: result.buffer!.toString("base64") },
  });
  expect(transported.regions).toEqual(result.regions);
  const processed = await renderService.ditherImage({
    buffer: transported.buffer!,
    size: transported.size,
    regions: transported.regions,
  });
  const image = await loadImage(processed.buffer);
  expect([image.width, image.height]).toEqual([800, 480]);
}, 30_000);
it("returns no frame when one required child fails", async () => {
  const result = await generateImageFromUrl({
    url: origin,
    kind: "epd7",
    orientation: "landscape",
    paper: { kind: "layout" },
    data: { layout: { renderId: "r1" }, fail: true },
  });
  expect(result.buffer).toBeNull();
  expect(result.diagnostics.outcome).toBe("error");
}, 30_000);
it("rejects redirects of the trusted layout before forwarding its payload", async () => {
  const result = await generateImageFromUrl({
    url: origin + "/redirect",
    kind: "epd7",
    paper: { kind: "layout" },
    data: { layout: { renderId: "r1" } },
  });
  expect(result.buffer).toBeNull();
  expect(result.diagnostics.error?.message).toContain("unexpected origin");
}, 30_000);
