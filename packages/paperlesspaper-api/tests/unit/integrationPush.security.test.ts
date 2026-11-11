import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import {
  publicAddress,
  sendCallback,
  validatePublicUrl,
} from "../../src/integrationPush/security.js";
import { integrationIdentity } from "../../src/integrationPush/access.js";
vi.mock("@internetderdinge/api", () => ({ ApiError: Error, User: {} }));
vi.mock("../../src/papers/papers.model.js", () => ({ default: {} }));
afterEach(() => vi.unstubAllEnvs());
it.each([
  "127.0.0.1",
  "10.0.0.1",
  "169.254.169.254",
  "192.168.1.2",
  "172.16.0.1",
  "100.64.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "fe80::1",
  "fd00::1",
  "2002:7f00:1::",
  "2001:db8::1",
])("rejects nonpublic callback IP %s", (ip) =>
  expect(publicAddress(ip)).toBe(false)
);
it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
  "permits public callback IP %s",
  (ip) => expect(publicAddress(ip)).toBe(true)
);
it("binds all integration endpoints to the saved manifest origin", () => {
  const paper: any = {
    kind: "plugin",
    meta: {
      pluginConfigUrl: "https://integration.example/config.json",
      pluginManifest: {
        renderPage: "./render.html",
        settingsPage: "./settings.html",
        capabilities: { contentPush: { callbackPath: "/api/status" } },
      },
    },
  };
  expect(integrationIdentity(paper).callbackUrl).toBe(
    "https://integration.example/api/status"
  );
  paper.meta.pluginManifest.capabilities.contentPush.callbackPath =
    "https://other.example/status";
  expect(() => integrationIdentity(paper)).toThrow("same origin");
  expect(() =>
    validatePublicUrl(new URL("https://user:password@example.com/callback"))
  ).toThrow();
  expect(() =>
    validatePublicUrl(new URL("http://example.com/callback"))
  ).toThrow();
});
it("sends bearer-authenticated callbacks but never follows redirects", async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("INTEGRATION_ALLOW_LOCALHOST", "true");
  const received: any[] = [];
  const server = createServer((req, res) => {
    received.push(req.headers.authorization);
    req.resume();
    res.writeHead(req.url === "/redirect" ? 302 : 200, { location: "/leak" });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    await sendCallback(`${base}/status`, "secret", { eventId: "one" });
    await expect(
      sendCallback(`${base}/redirect`, "secret", {})
    ).rejects.toThrow();
    expect(received).toEqual(["Bearer secret", "Bearer secret"]);
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      sendCallback(`${base}/status`, "secret", {})
    ).rejects.toThrow();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
