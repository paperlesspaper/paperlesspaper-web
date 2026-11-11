import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAllowedPrivateRenderOrigins,
  isPublicRenderAddress,
  parseRenderUrl,
  resolveRenderAddresses,
  resolveRenderUrl,
} from "../../src/render/renderNetwork";

afterEach(() => vi.unstubAllEnvs());

describe("render network policy", () => {
  it.each([
    "0.0.0.0",
    "10.2.3.4",
    "100.64.0.1",
    "127.0.0.1",
    "127.99.1.2",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "192.0.0.8",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "168.63.129.16",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "64:ff9b::7f00:1",
    "2001::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "3fff::1",
    "garbage",
  ])("blocks private/special address %s", (address) => {
    expect(isPublicRenderAddress(address)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("allows public address %s", (address) => {
    expect(isPublicRenderAddress(address)).toBe(true);
  });

  it.each([
    "file:///tmp/test",
    "data:text/html,hello",
    "javascript:alert(1)",
    "ftp://example.org",
    "https://user:pass@example.org",
  ])("rejects unsafe navigation %s", (url) => {
    expect(() => parseRenderUrl(url)).toThrow();
  });

  it.each([
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://[::ffff:127.0.0.1]",
  ])("normalizes and blocks disguised loopback %s", async (url) => {
    await expect(resolveRenderAddresses(parseRenderUrl(url))).rejects.toThrow(
      "not a public"
    );
  });

  it("checks every DNS answer and rejects mixed public/private destinations", async () => {
    const dns = vi.fn(async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "::1", family: 6 },
    ]);
    await expect(
      resolveRenderAddresses(new URL("https://mixed.example"), new Set(), dns)
    ).rejects.toThrow("not a public");
  });

  it("returns a checked numeric address and rechecks changed DNS answers", async () => {
    const dns = vi
      .fn()
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    const url = new URL("https://rebind.example");
    expect(await resolveRenderAddresses(url, new Set(), dns)).toEqual([
      { address: "8.8.8.8", family: 4 },
    ]);
    await expect(resolveRenderAddresses(url, new Set(), dns)).rejects.toThrow(
      "not a public"
    );
  });

  it("fails closed on DNS failure or an empty answer", async () => {
    await expect(
      resolveRenderAddresses(
        new URL("https://missing.example"),
        new Set(),
        async () => []
      )
    ).rejects.toThrow();
    await expect(
      resolveRenderAddresses(
        new URL("https://missing.example"),
        new Set(),
        async () => {
          throw new Error("DNS failed");
        }
      )
    ).rejects.toThrow();
  });

  it("allows only the exact development origin, including scheme and port", async () => {
    const allowed = new Set(["http://127.0.0.1:8080"]);
    expect(
      await resolveRenderAddresses(
        new URL("http://127.0.0.1:8080/app"),
        allowed
      )
    ).toEqual([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      resolveRenderAddresses(new URL("http://127.0.0.1:8081/app"), allowed)
    ).rejects.toThrow();
    await expect(
      resolveRenderAddresses(new URL("https://127.0.0.1:8080/app"), allowed)
    ).rejects.toThrow();
  });

  it("does not permit private-origin exceptions in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", "http://localhost:3000");
    expect(getAllowedPrivateRenderOrigins).toThrow("outside production");
  });

  it("remaps only the exact apps origin, preserving path/query/hash", () => {
    vi.stubEnv("PAPERLESSPAPER_APPS_URL", "http://localhost:3000/prefix");
    expect(
      resolveRenderUrl("https://apps.paperlesspaper.de/weather?q=1#test")
    ).toBe("http://localhost:3000/prefix/weather?q=1#test");
    for (const url of [
      "https://apps.paperlesspaper.de.evil.example/weather",
      "https://example.org/?url=https://apps.paperlesspaper.de",
    ]) {
      expect(resolveRenderUrl(url)).toBe(url);
    }
    vi.stubEnv("PAPERLESSPAPER_APPS_URL", "http://localhost:3000");
    expect(
      resolveRenderUrl("https://apps.paperlesspaper.de//example.org/path")
    ).toBe("http://localhost:3000//example.org/path");
  });
});
