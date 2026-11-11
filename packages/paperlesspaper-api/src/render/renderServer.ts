import { createServer } from "node:http";
import type { GenerateImageOptions, RenderResult } from "./render.types";
import {
  MAX_RENDER_REQUEST_BYTES,
  MAX_RENDER_RESPONSE_BYTES,
  parseRenderRequest,
  RENDER_DEADLINE_MS,
} from "./renderProtocol";

type Render = (
  options: GenerateImageOptions,
  signal: AbortSignal
) => Promise<RenderResult>;

// The server is bound to a mode-0600 Unix socket by renderer/main.ts, never to TCP.
export function createRenderServer(
  render: Render,
  ready: () => Promise<void>,
  { concurrency = 2, deadlineMs = RENDER_DEADLINE_MS } = {}
) {
  let active = 0;
  return createServer(
    { requestTimeout: 15_000, headersTimeout: 10_000, maxHeaderSize: 8192 },
    async (req, res) => {
      const reply = (status: number, body: unknown) => {
        if (res.destroyed || res.writableEnded) return;
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(body));
      };
      if (req.method === "GET" && req.url === "/health") {
        try {
          await ready();
          reply(200, { status: "ready" });
        } catch {
          reply(503, { status: "unavailable" });
        }
        return;
      }
      if (req.method !== "POST" || req.url !== "/v1/render") {
        reply(404, { error: "Not found" });
        return;
      }
      if (req.headers["content-type"]?.split(";")[0] !== "application/json") {
        reply(415, { error: "Expected JSON" });
        return;
      }
      if (active >= concurrency) {
        res.setHeader("Connection", "close");
        reply(503, { error: "Renderer busy" });
        return;
      }
      active++;
      const controller = new AbortController();
      const abort = () => controller.abort();
      res.on("close", abort);
      const deadline = setTimeout(() => {
        controller.abort();
        reply(504, { error: "Render deadline exceeded" });
        req.destroy();
      }, deadlineMs);
      try {
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_RENDER_REQUEST_BYTES) {
            res.setHeader("Connection", "close");
            reply(413, { error: "Render request too large" });
            return;
          }
          chunks.push(chunk);
        }
        let options: GenerateImageOptions;
        try {
          options = parseRenderRequest(
            JSON.parse(Buffer.concat(chunks).toString("utf8"))
          );
        } catch {
          reply(400, { error: "Invalid render request" });
          return;
        }
        controller.signal.throwIfAborted();
        const result = await render(options, controller.signal);
        controller.signal.throwIfAborted();
        const body = JSON.stringify({
          version: 1,
          result: {
            ...result,
            buffer: result.buffer?.toString("base64") ?? null,
          },
        });
        if (Buffer.byteLength(body) > MAX_RENDER_RESPONSE_BYTES) {
          reply(502, { error: "Render result too large" });
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(body);
      } catch {
        reply(502, { error: "Rendering failed" });
      } finally {
        clearTimeout(deadline);
        res.off("close", abort);
        active--;
      }
    }
  );
}
