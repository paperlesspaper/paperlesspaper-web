import { chmod, lstat, unlink } from "node:fs/promises";
import { connect } from "node:net";
import {
  generateImageFromUrl,
  closeRenderBrowser,
  warmRenderBrowser,
} from "../../packages/paperlesspaper-api/src/render/render.browser";
import { createRenderServer } from "../../packages/paperlesspaper-api/src/render/renderServer";

const socketPath =
  process.env.RENDER_SERVICE_SOCKET ||
  "/run/paperlesspaper-renderer/renderer.sock";
process.umask(0o077);
// A restart can leave a stale socket in the named volume. Never replace a live listener or a regular file.
try {
  const entry = await lstat(socketPath);
  if (!entry.isSocket()) throw new Error("Renderer path is not a socket");
  const live = await new Promise<boolean>((resolve, reject) => {
    const socket = connect(socketPath);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", (error: NodeJS.ErrnoException) =>
      error.code === "ECONNREFUSED" ? resolve(false) : reject(error)
    );
  });
  if (live) throw new Error("Renderer socket is already in use");
  await unlink(socketPath);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
await warmRenderBrowser();
const server = createRenderServer(generateImageFromUrl, warmRenderBrowser);
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(socketPath, resolve);
});
await chmod(socketPath, 0o600);
console.log(
  `Renderer ready (private Unix socket, Chromium sandbox ${
    process.env.RENDERER_DISABLE_CHROMIUM_SANDBOX === "true" ? "disabled; container isolation required" : "enabled"
  })`
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10_000);
  server.close();
  server.closeAllConnections();
  await closeRenderBrowser();
  await unlink(socketPath).catch(() => {});
  clearTimeout(deadline);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
