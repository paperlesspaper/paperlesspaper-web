import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createRenderQueue } from "./renderQueue";
import type { GenerateImageOptions, RenderResult } from "./render.types";
import {
  decodeRenderResult,
  MAX_RENDER_REQUEST_BYTES,
  MAX_RENDER_RESPONSE_BYTES,
  parseRenderRequest,
  RENDER_DEADLINE_MS,
} from "./renderProtocol";

const queueRender = createRenderQueue();
class RendererBusy extends Error {}

export function requestRender(
  options: GenerateImageOptions,
  socketPath: string
): Promise<RenderResult> {
  const body = JSON.stringify(parseRenderRequest(options));
  if (Buffer.byteLength(body) > MAX_RENDER_REQUEST_BYTES)
    return Promise.reject(new Error("Render request too large"));
  return queueRender(async () => {
    const deadline = Date.now() + RENDER_DEADLINE_MS + 5_000;
    while (true) {
      try {
        return await sendRender(
          body,
          socketPath,
          Math.max(1, deadline - Date.now())
        );
      } catch (error) {
        // A second API replica can briefly compete during a rolling deploy.
        // Only retry an explicit busy rejection, before any rendering started.
        if (!(error instanceof RendererBusy) || Date.now() + 250 >= deadline)
          throw error;
        await delay(250);
      }
    }
  }, Buffer.byteLength(body));
}

function sendRender(
  body: string,
  socketPath: string,
  timeoutMs: number
): Promise<RenderResult> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path: "/v1/render",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode === 503) {
          let text = "";
          res.on("data", (chunk) => {
            text += chunk;
            if (text.length > 1024)
              req.destroy(new Error("Invalid renderer response"));
          });
          res.on("error", reject);
          res.on("end", () => {
            try {
              if (JSON.parse(text).error === "Renderer busy") {
                reject(new RendererBusy("Renderer busy"));
                return;
              }
            } catch {
              /* Unrecognized failures must not be retried. */
            }
            reject(new Error("Renderer unavailable (HTTP 503)"));
          });
          return;
        }
        // Never follow redirects or retry a render that has already started.
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Renderer unavailable (HTTP ${res.statusCode})`));
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_RENDER_RESPONSE_BYTES) {
            req.destroy(new Error("Renderer response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          try {
            resolve(
              decodeRenderResult(
                JSON.parse(Buffer.concat(chunks).toString("utf8"))
              )
            );
          } catch {
            reject(new Error("Invalid renderer response"));
          }
        });
      }
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("Renderer request timed out")),
      timeoutMs
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", () => reject(new Error("Renderer request failed")));
    req.end(body);
  });
}
