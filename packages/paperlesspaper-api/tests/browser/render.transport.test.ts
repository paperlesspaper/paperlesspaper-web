import { beforeAll, afterAll, expect, it } from "vitest";
import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { requestRender } from "../../src/render/renderClient";

const root = path.resolve(import.meta.dirname, "../../../..");
const workerDirectory = path.join(root, "tools/paperlesspaper-renderer");
const fixture = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    '<html><head><meta name="paperless:epd-optimize" content=\'{"intent":"faithful"}\'></head><body style="margin:0;background:rgb(255,0,0)"><div id="website-has-loaded"></div></body></html>'
  );
});
let worker: ChildProcess;
let directory: string;
let socket: string;
let url: string;
let workerOutput = "";
beforeAll(async () => {
  directory = await mkdtemp(`${tmpdir()}/worker-`);
  socket = `${directory}/s`;
  await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(fixture.address() as any).port}`;
  await build({
    entryPoints: [path.join(workerDirectory, "main.ts")],
    absWorkingDir: root,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    packages: "external",
    alias: {
      "@paperlesspaper/helpers": "./packages/helpers/src/deviceList.ts",
    },
    outfile: path.join(workerDirectory, "dist/main.mjs"),
  });
  worker = spawn(
    process.execPath,
    [path.join(workerDirectory, "dist/main.mjs")],
    {
      env: {
        PATH: process.env.PATH,
        HOME: directory,
        NODE_ENV: "test",
        CHROME_BIN: process.env.CHROME_BIN,
        RENDER_SERVICE_SOCKET: socket,
        RENDER_ALLOWED_PRIVATE_ORIGINS: url,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Worker startup timeout: ${workerOutput}`)),
      20_000
    );
    worker.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Worker exited ${code}: ${workerOutput}`));
    });
    worker.stderr!.on("data", (chunk) => (workerOutput += chunk));
    worker.stdout!.on("data", (chunk) => {
      workerOutput += chunk;
      if (workerOutput.includes("Renderer ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}, 30_000);
afterAll(async () => {
  if (worker && worker.exitCode === null) {
    const exited = new Promise<void>((resolve) =>
      worker.once("exit", () => resolve())
    );
    worker.kill("SIGTERM");
    await exited;
  }
  fixture.closeAllConnections();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});
it("renders through a separate process and private socket without changing colors or dimensions", async () => {
  const result = await requestRender(
    { url, kind: "epd7", orientation: "landscape", paper: { kind: "plugin" } },
    socket
  );
  expect(
    result.diagnostics.outcome,
    JSON.stringify(result.diagnostics.error)
  ).toBe("success");
  expect(result.epdOptimizeSettings).toEqual({ intent: "faithful" });
  expect(result.size).toMatchObject({
    width: 800,
    height: 480,
    name: "landscape",
  });
  const image = await loadImage(result.buffer!);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  expect([...context.getImageData(400, 240, 1, 1).data]).toEqual([
    255, 0, 0, 255,
  ]);
  expect((await stat(socket)).mode & 0o777).toBe(0o600);
}, 30_000);
it("still blocks private targets outside the explicitly allowed test fixture", async () => {
  const result = await requestRender(
    { url: "http://169.254.169.254/latest/meta-data/", kind: "epd7" },
    socket
  );
  expect(result.buffer).toBeNull();
  expect(result.diagnostics.outcome).toBe("error");
  expect(result.diagnostics.error?.message).toContain("HTTP 403");
}, 30_000);
