import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ key: "" }));
vi.mock("jwks-rsa", () => ({
  default: () => ({
    getSigningKey: async () => ({ getPublicKey: () => mocks.key }),
  }),
}));
vi.mock("@internetderdinge/api", async () => ({
  ApiError: (await import("@internetderdinge/api/src/utils/ApiError")).default,
}));
import { verifyRecentLogin } from "../../src/accounts/reauthenticate.js";
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const now = () => Math.floor(Date.now() / 1000);
const token = (
  claims: Record<string, unknown> = {},
  options: jwt.SignOptions = {}
) =>
  jwt.sign({ auth_time: now(), ...claims }, privateKey, {
    algorithm: "RS256",
    keyid: "test-key",
    issuer: "https://account-test.invalid/",
    subject: "auth0|owner",
    audience: "web-client",
    expiresIn: 300,
    ...options,
  });
beforeEach(() => {
  vi.stubEnv("AUTH0_DOMAIN", "account-test.invalid");
  mocks.key = publicKey.export({ type: "spki", format: "pem" }) as string;
});
afterEach(() => vi.unstubAllEnvs());
describe("server-verified reauthentication", () => {
  it("accepts a recent signed ID token for the current account and client", async () => {
    await expect(
      verifyRecentLogin(token(), "auth0|owner", "web-client")
    ).resolves.toBeUndefined();
  });
  it.each([
    ["wrong account", () => token({}, { subject: "auth0|another" })],
    ["wrong application", () => token({}, { audience: "other-client" })],
    ["wrong issuer", () => token({}, { issuer: "https://another.invalid/" })],
    ["expired token", () => token({}, { expiresIn: -1 })],
    ["missing auth_time", () => token({ auth_time: undefined })],
    ["string auth_time", () => token({ auth_time: String(now()) })],
    ["old authentication", () => token({ auth_time: now() - 301 })],
    ["future authentication", () => token({ auth_time: now() + 60 })],
    ["wrong authorized party", () => token({ azp: "other-client" })],
    ["invalid signature", () => token().slice(0, -8) + "tampered"],
    [
      "unsigned token",
      () =>
        jwt.sign({ sub: "auth0|owner", auth_time: now() }, null, {
          algorithm: "none",
        }),
    ],
  ] as const)("rejects %s", async (_name, create) => {
    await expect(
      verifyRecentLogin(create(), "auth0|owner", "web-client")
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
