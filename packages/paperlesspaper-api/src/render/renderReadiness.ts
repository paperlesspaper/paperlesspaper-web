import { request } from "node:http";

/** Fail deployment startup before accepting traffic if the renderer is not wired. */
export async function assertProductionRendererReady() {
  if (process.env.NODE_ENV !== "production") return;
  const socketPath = process.env.RENDER_SERVICE_SOCKET;
  if (!socketPath)
    throw new Error("RENDER_SERVICE_SOCKET is required in production");
  await new Promise<void>((resolve, reject) => {
    const req = request(
      { socketPath, path: "/health", method: "GET" },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1024)
            req.destroy(new Error("Invalid renderer health response"));
        });
        res.on("error", reject);
        res.on("end", () => {
          try {
            if (res.statusCode === 200 && JSON.parse(body).status === "ready") {
              resolve();
              return;
            }
          } catch {
            /* Fail closed on invalid health responses. */
          }
          reject(new Error("Production renderer is not ready"));
        });
      }
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Renderer health check timed out")),
      8_000
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", () =>
      reject(new Error("Production renderer is unreachable"))
    );
    req.end();
  });
}
