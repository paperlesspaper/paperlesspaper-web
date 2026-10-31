import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { request, type Server } from "node:http";
import { createRenderServer } from "../../src/render/renderServer";
import { requestRender } from "../../src/render/renderClient";
import { assertProductionRendererReady } from "../../src/render/renderReadiness";
import {
  parseRenderRequest,
  MAX_RENDER_REQUEST_BYTES,
} from "../../src/render/renderProtocol";
import type { RenderResult } from "../../src/render/render.types";

const options = { url: "https://example.com", kind: "epd7" };
const result = {
  buffer: Buffer.from([137, 80, 78, 71, 0, 255]),
  size: { width: 480, height: 800, name: "portrait", frameKind: "epd7" },
  diagnostics: { outcome: "success" },
  epdOptimizeSettings: { brightness: 1.2 },
} as unknown as RenderResult;
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});
async function listen(server: Server) {
  const dir = await mkdtemp(`${tmpdir()}/render-`);
  const socket = `${dir}/s`;
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  return socket;
}
function post(socketPath: string, body: string) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path: "/v1/render",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode!, body: JSON.parse(text) })
        );
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

describe("isolated renderer transport", () => {
  it("requires a ready renderer at production startup", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RENDER_SERVICE_SOCKET", "");
    await expect(assertProductionRendererReady()).rejects.toThrow("required");
    vi.stubEnv("RENDER_SERVICE_SOCKET", "/nonexistent/renderer.sock");
    await expect(assertProductionRendererReady()).rejects.toThrow(
      "unreachable"
    );
    const socket = await listen(
      createRenderServer(
        async () => result,
        async () => {}
      )
    );
    vi.stubEnv("RENDER_SERVICE_SOCKET", socket);
    await expect(assertProductionRendererReady()).resolves.toBeUndefined();
    const unavailable = await listen(
      createRenderServer(
        async () => result,
        async () => {
          throw new Error("Chromium failed");
        }
      )
    );
    vi.stubEnv("RENDER_SERVICE_SOCKET", unavailable);
    await expect(assertProductionRendererReady()).rejects.toThrow("not ready");
  });
  it("completes a concurrent cronjob burst through the two-slot renderer", async () => {
    let active = 0;
    let peak = 0;
    const render = vi.fn(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return result;
    });
    const socket = await listen(createRenderServer(render, async () => {}));
    const results = await Promise.all(
      Array.from({ length: 20 }, () => requestRender(options, socket))
    );
    expect(results).toEqual(Array(20).fill(result));
    expect(render).toHaveBeenCalledTimes(20);
    expect(peak).toBe(2);
  });
  it("waits for capacity occupied by another API replica during deployment", async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let calls = 0;
    const socket = await listen(
      createRenderServer(
        async () => {
          if (++calls === 1) {
            entered();
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return result;
        },
        async () => {},
        { concurrency: 1 }
      )
    );
    const otherReplica = post(socket, JSON.stringify(options));
    await started;
    expect(await requestRender(options, socket)).toEqual(result);
    expect((await otherReplica).status).toBe(200);
    expect(calls).toBe(2);
  });
  it("preserves image bytes, dimensions and metadata, but never sends the API token", async () => {
    const render = vi.fn(async (_options: unknown) => result);
    const socket = await listen(createRenderServer(render, async () => {}));
    expect(
      await requestRender(
        { ...options, token: "api-secret", data: { text: "Hello" } },
        socket
      )
    ).toEqual(result);
    expect(render.mock.calls[0][0]).toEqual({
      ...options,
      data: { text: "Hello" },
    });
  });
  it("preserves failed render diagnostics and the null image", async () => {
    const failure = {
      ...result,
      buffer: null,
      diagnostics: { outcome: "error", error: { message: "page not ready" } },
    } as RenderResult;
    const socket = await listen(
      createRenderServer(
        async () => failure,
        async () => {}
      )
    );
    expect(await requestRender(options, socket)).toEqual(failure);
  });
  it.each([
    { ...options, url: "file:///etc/passwd" },
    { ...options, url: "https://user:pass@example.com" },
    { ...options, orientation: "invalid" },
    { ...options, scroll: Infinity },
  ])("rejects invalid requests before invoking Chromium: %j", (value) => {
    expect(() => parseRenderRequest(value)).toThrow();
  });
  it("rejects malformed JSON and oversized bodies", async () => {
    const render = vi.fn(async () => result);
    const socket = await listen(createRenderServer(render, async () => {}));
    expect((await post(socket, "{")).status).toBe(400);
    expect(
      (await post(socket, "x".repeat(MAX_RENDER_REQUEST_BYTES + 1))).status
    ).toBe(413);
    expect(render).not.toHaveBeenCalled();
  });
  it("bounds concurrency and cancels work when the client disconnects", async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    let aborted!: () => void;
    const stopped = new Promise<void>((resolve) => (aborted = resolve));
    const render = vi.fn(
      (_options, signal: AbortSignal) =>
        new Promise<RenderResult>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted();
            reject(new Error("cancelled"));
          });
          entered();
        })
    );
    const socketPath = await listen(
      createRenderServer(render, async () => {}, { concurrency: 1 })
    );
    const req = request({
      socketPath,
      path: "/v1/render",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    req.on("error", () => {});
    req.end(JSON.stringify(options));
    await started;
    expect((await post(socketPath, JSON.stringify(options))).status).toBe(503);
    req.destroy();
    await stopped;
    expect(render).toHaveBeenCalledOnce();
  });
  it("aborts the browser job on the server deadline", async () => {
    let cancelled = false;
    const socket = await listen(
      createRenderServer(
        (_options, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              cancelled = true;
              reject(new Error("cancelled"));
            });
          }),
        async () => {},
        { deadlineMs: 30 }
      )
    );
    await expect(requestRender(options, socket)).rejects.toThrow();
    expect(cancelled).toBe(true);
  });
  it("does not launch a local browser if the service is unavailable or production is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RENDER_SERVICE_SOCKET", "/nonexistent/renderer.sock");
    const { default: service } = await import(
      "../../src/render/render.service"
    );
    await expect(service.generateImageFromUrl(options)).rejects.toThrow(
      "Renderer request failed"
    );
    vi.stubEnv("RENDER_SERVICE_SOCKET", "");
    await expect(service.generateImageFromUrl(options)).rejects.toThrow(
      "RENDER_SERVICE_SOCKET is required"
    );
  });
});
