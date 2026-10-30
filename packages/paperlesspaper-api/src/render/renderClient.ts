import { request } from "node:http";
import type { GenerateImageOptions, RenderResult } from "./render.types";
import {
  decodeRenderResult,
  MAX_RENDER_REQUEST_BYTES,
  MAX_RENDER_RESPONSE_BYTES,
  parseRenderRequest,
  RENDER_DEADLINE_MS,
} from "./renderProtocol";

export function requestRender(
  options: GenerateImageOptions,
  socketPath: string
): Promise<RenderResult> {
  const body = JSON.stringify(parseRenderRequest(options));
  if (Buffer.byteLength(body) > MAX_RENDER_REQUEST_BYTES)
    return Promise.reject(new Error("Render request too large"));
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
        // Never follow redirects or retry a failed render in the API container.
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
      RENDER_DEADLINE_MS + 5_000
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", () => reject(new Error("Renderer request failed")));
    req.end(body);
  });
}
