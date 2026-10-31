import express from "express";
import type { ErrorRequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  findOneAndUpdate: vi.fn(),
  legacyHandler: vi.fn(),
}));

vi.mock("@internetderdinge/api", async () => {
  const { default: validateZod } = await import(
    "@internetderdinge/api/src/middlewares/validateZod"
  );
  const { default: catchAsync } = await import(
    "@internetderdinge/api/src/utils/catchAsync"
  );
  const { default: ApiError } = await import(
    "@internetderdinge/api/src/utils/ApiError"
  );
  const { extendZodWithOpenApi } = await import(
    "@asteasolutions/zod-to-openapi"
  );
  const { z } = await import("zod");
  extendZodWithOpenApi(z);
  const { zObjectId } = await import(
    "@internetderdinge/api/src/utils/zValidations"
  );
  return {
    ApiError,
    catchAsync,
    validateZod,
    zObjectId,
    User: { exists: mocks.exists, findOneAndUpdate: mocks.findOneAndUpdate },
    auth: () => (req: any, _res: any, next: any) => {
      if (req.headers.authorization !== "Bearer test-user") {
        next(new ApiError(401, "Please authenticate"));
        return;
      }
      req.auth = { sub: "auth0|test-user" };
      next();
    },
  };
});

import invitationsRoute from "../../src/invitations/invitations.route.js";

const organization = "111111111111111111111111";
const validBody = {
  organization,
  status: "accepted",
  inviteCode: "a".repeat(64),
};
const app = express();
app.use(express.json());
app.use("/v1/users", invitationsRoute);
app.post("/v1/users/invite", mocks.legacyHandler);
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error.statusCode || 500).send({ message: error.message });
};
app.use(errorHandler);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.exists.mockResolvedValue(null);
  mocks.findOneAndUpdate.mockResolvedValue({
    id: "222222222222222222222222",
    organization,
    owner: "auth0|test-user",
    status: "accepted",
    inviteCode: null,
  });
  mocks.legacyHandler.mockImplementation((_req, res) => res.sendStatus(418));
});

const accept = (body: unknown, path = "/v1/users/invite") =>
  request(app).post(path).set("Authorization", "Bearer test-user").send(body);

describe("invitation acceptance", () => {
  it.each([
    undefined,
    null,
    "",
    " ",
    "\t\n",
    123,
    [],
    { $ne: null },
    "a".repeat(257),
  ])(
    "rejects invalid invitation code %j before accessing users",
    async (inviteCode) => {
      const response = await accept({ ...validBody, inviteCode });
      expect(response.status).toBe(400);
      expect(mocks.exists).not.toHaveBeenCalled();
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mocks.legacyHandler).not.toHaveBeenCalled();
    }
  );

  it.each([
    { organization: "not-an-id" },
    { organization: { $ne: null } },
    { owner: "auth0|another-user" },
    { role: "admin" },
    { status: "invited" },
  ])("rejects malformed or additional fields: %j", async (fields) => {
    const response = await accept({ ...validBody, ...fields });
    expect(response.status).toBe(400);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.legacyHandler).not.toHaveBeenCalled();
  });

  it.each(["/v1/users/invite", "/v1/users/invite/", "/v1/users/INVITE"])(
    "claims only an open invitation in the requested organization at %s",
    async (path) => {
      const response = await accept(validBody, path);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        owner: "auth0|test-user",
        inviteCode: null,
      });
      expect(mocks.exists).toHaveBeenCalledExactlyOnceWith({
        owner: "auth0|test-user",
        organization,
      });
      expect(mocks.findOneAndUpdate).toHaveBeenCalledExactlyOnceWith(
        {
          organization,
          inviteCode: validBody.inviteCode,
          status: "invited",
          owner: { $exists: false },
        },
        {
          $set: {
            owner: "auth0|test-user",
            status: "accepted",
            inviteCode: null,
          },
        },
        { new: true, runValidators: true }
      );
      expect(mocks.legacyHandler).not.toHaveBeenCalled();
    }
  );

  it("requires authentication", async () => {
    const response = await request(app)
      .post("/v1/users/invite")
      .send(validBody);
    expect(response.status).toBe(401);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.legacyHandler).not.toHaveBeenCalled();
  });

  it("rejects an unknown or already consumed invitation", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    expect((await accept(validBody)).status).toBe(404);
    expect(mocks.legacyHandler).not.toHaveBeenCalled();
  });

  it("does not consume an invitation for an existing member", async () => {
    mocks.exists.mockResolvedValue({ _id: "existing-membership" });
    expect((await accept(validBody)).status).toBe(409);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.legacyHandler).not.toHaveBeenCalled();
  });
});
