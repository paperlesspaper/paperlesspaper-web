import { generateKeyPairSync, createHash } from "node:crypto";
import express from "express";
import type { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicKey: undefined as any,
  findToken: vi.fn(),
  getRoles: vi.fn(),
  disableMfa: vi.fn(),
  getAccount: vi.fn(),
}));

// Exercise the shared router, controller and JWT verifier. Only external
// database/Auth0 access is replaced with synthetic test data and signing keys.
vi.mock("jwks-rsa", () => ({
  default: {
    expressJwtSecret: () => async () => mocks.publicKey,
  },
}));
vi.mock("@internetderdinge/api/src/tokens/tokens.model", () => ({
  default: { findOne: mocks.findToken },
}));
vi.mock("@internetderdinge/api/src/accounts/auth0.service", () => ({
  default: { auth0: { users: { roles: { list: mocks.getRoles } } } },
}));
vi.mock("@internetderdinge/api/src/accounts/accounts.service", () => ({
  mfaDisable: mocks.disableMfa,
  getAccountById: mocks.getAccount,
}));
vi.mock(
  "@internetderdinge/api/src/devicesNotifications/devicesNotifications.service",
  () => ({ default: {} })
);
vi.mock("@internetderdinge/api", async () => {
  const { default: accountsRoute } = await import(
    "@internetderdinge/api/src/accounts/accounts.route"
  );
  const { default: ApiError } = await import(
    "@internetderdinge/api/src/utils/ApiError"
  );
  const { default: auth } = await import(
    "@internetderdinge/api/src/middlewares/auth"
  );
  const { default: catchAsync } = await import(
    "@internetderdinge/api/src/utils/catchAsync"
  );
  const { default: validateZod } = await import(
    "@internetderdinge/api/src/middlewares/validateZod"
  );
  return {
    accountsRoute,
    ApiError,
    auth,
    catchAsync,
    validateZod,
    auth0: { users: { get: mocks.getAccount } },
  };
});

import accountsRoute from "../../src/accounts/accounts.route.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const apiKey = "a".repeat(64);
const userId = "auth0|mfa-test-user";
const issuer = "https://mfa-test.invalid/";
const disablePath = "/v1/accounts/current/mfa/disable";
const app = express();
app.use(express.json());
app.use("/v1/accounts", accountsRoute);
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error.statusCode || 500).send({ message: error.message });
};
app.use(errorHandler);

const accessToken = (overrides: jwt.SignOptions = {}) =>
  jwt.sign({ sub: userId }, privateKey, {
    algorithm: "RS256",
    issuer,
    expiresIn: "5m",
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH0_DOMAIN", "mfa-test.invalid");
  mocks.publicKey = publicKey;
  mocks.findToken.mockImplementation((filter) => ({
    select: async () =>
      filter.value === createHash("sha256").update(apiKey).digest("hex")
        ? { owner: userId, _id: "test-api-key" }
        : null,
  }));
  mocks.getRoles.mockResolvedValue([{ name: "admin" }]);
  mocks.disableMfa.mockResolvedValue({ success: true });
  mocks.getAccount.mockResolvedValue({ user_id: userId });
});

afterEach(() => vi.unstubAllEnvs());

describe("MFA disable authentication", () => {
  it.each(["get", "post", "delete"] as const)(
    "rejects API keys on account-security %s endpoints",
    async (method) => {
      const path =
        method === "get"
          ? "/v1/accounts/current/security"
          : "/v1/accounts/current/security/email";
      const response = await request(app)
        [method](path)
        .set("X-API-Key", apiKey)
        .send({});
      expect(response.status).toBe(403);
      expect(mocks.getAccount).not.toHaveBeenCalled();
    }
  );

  it("requires reauthentication proof before accepting a password change", async () => {
    const response = await request(app)
      .post("/v1/accounts/current/security/password")
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({ password: "a-new-password" });
    expect(response.status).toBe(400);
    expect(mocks.getAccount).not.toHaveBeenCalled();
  });

  it.each(["post", "patch"] as const)(
    "blocks email changes through legacy profile %s",
    async (method) => {
      mocks.getAccount.mockResolvedValue({
        user_id: userId,
        email: "old@example.com",
      });
      const response = await request(app)
        [method](`/v1/accounts/${userId}`)
        .set("Authorization", `Bearer ${accessToken()}`)
        .send({ email: "new@example.com" });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain("separate email change");
    }
  );

  it.each([disablePath, `${disablePath}/`, "/v1/accounts/CURRENT/MFA/DISABLE"])(
    "rejects even an admin API key on %s",
    async (path) => {
      const response = await request(app)
        .post(path)
        .set("X-API-Key", apiKey)
        .send({});

      expect(response.status).toBe(403);
      expect(mocks.disableMfa).not.toHaveBeenCalled();
      expect(mocks.findToken).not.toHaveBeenCalled();
    }
  );

  it("rejects an API key even when a valid Bearer JWT is also supplied", async () => {
    const response = await request(app)
      .post(disablePath)
      .set("X-API-Key", apiKey)
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({});

    expect(response.status).toBe(403);
    expect(mocks.disableMfa).not.toHaveBeenCalled();
  });

  it("allows a verified user JWT and uses its subject for the MFA operation", async () => {
    const response = await request(app)
      .post(disablePath)
      .set("Authorization", `Bearer ${accessToken()}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(mocks.disableMfa).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it.each([
    ["missing credentials", () => undefined],
    ["malformed JWT", () => "Bearer invalid"],
    ["API key used as Bearer token", () => `Bearer ${apiKey}`],
    ["expired JWT", () => `Bearer ${accessToken({ expiresIn: -1 })}`],
    [
      "wrong issuer",
      () => `Bearer ${accessToken({ issuer: "https://other.invalid/" })}`,
    ],
  ] as const)("rejects %s", async (_label, authorization) => {
    const operation = request(app).post(disablePath);
    const header = authorization();
    if (header) operation.set("Authorization", header);
    const response = await operation.send({});

    expect(response.status).toBe(401);
    expect(mocks.disableMfa).not.toHaveBeenCalled();
  });

  it("retains API-key authentication for other account endpoints", async () => {
    const response = await request(app)
      .get("/v1/accounts/current")
      .set("X-API-Key", apiKey);

    expect(response.status).toBe(200);
    expect(mocks.getAccount).toHaveBeenCalledExactlyOnceWith(userId);
    expect(mocks.disableMfa).not.toHaveBeenCalled();
  });
});
