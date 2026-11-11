import express from "express";
import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@internetderdinge/api", async () => {
  const { User } = await import("@internetderdinge/api/src/users/users.model");
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
    User,
    validateZod,
    catchAsync,
    ApiError,
    zObjectId,
    auth: () => (req: any, _res: any, next: any) => {
      const subject = /^Bearer (auth0\|test-[ab])$/.exec(
        req.headers.authorization || ""
      )?.[1];
      if (!subject) return next(new ApiError(401, "Please authenticate"));
      req.auth = { sub: subject };
      next();
    },
  };
});

import { User } from "@internetderdinge/api";
import invitationsRoute from "../../src/invitations/invitations.route.js";

const url = process.env.INVITATION_TEST_MONGODB_URL;
const app = express();
app.use(express.json());
app.use("/v1/users", invitationsRoute);
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error.statusCode || 500).send({ message: error.message });
};
app.use(errorHandler);

describe.skipIf(!url)("invitation acceptance with MongoDB", () => {
  const organization = "111111111111111111111111";
  const foreignOrganization = "222222222222222222222222";
  const inviteCode = "a".repeat(64);
  const invite = { organization, inviteCode, status: "invited", role: "user" };
  const accept = (owner = "auth0|test-a", body: Record<string, unknown> = {}) =>
    request(app)
      .post("/v1/users/invite")
      .set("Authorization", `Bearer ${owner}`)
      .send({ organization, inviteCode, status: "accepted", ...body });

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
      !parsed.pathname.startsWith("/paperless-invitation-test-")
    ) {
      throw new Error(
        "Use a disposable local database named paperless-invitation-test-*"
      );
    }
    await mongoose.connect(url!);
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it.each([null, undefined, "", " "])(
    "cannot claim an unowned foreign profile using code %j",
    async (code) => {
      const victim = await User.create({
        organization: foreignOrganization,
        role: "admin",
      });
      expect((await accept(undefined, { inviteCode: code })).status).toBe(400);
      expect((await User.findById(victim._id))?.owner).toBeUndefined();
    }
  );

  it("does not accept a valid code for another organization", async () => {
    const victim = await User.create({
      ...invite,
      organization: foreignOrganization,
    });
    expect((await accept()).status).toBe(404);
    expect((await User.findById(victim._id))?.owner).toBeUndefined();
  });

  it.each(["accepted", "revoked", undefined])(
    "rejects invitations that are not pending (%s)",
    async (status) => {
      const victim = await User.create({ ...invite, status });
      expect((await accept()).status).toBe(404);
      expect((await User.findById(victim._id))?.owner).toBeUndefined();
    }
  );

  it("cannot take over an already owned profile even if it retains a code", async () => {
    const victim = await User.create({ ...invite, owner: "auth0|test-b" });
    expect((await accept()).status).toBe(404);
    expect((await User.findById(victim._id))?.owner).toBe("auth0|test-b");
  });

  it("accepts a valid invitation once and preserves its assigned role", async () => {
    const pending = await User.create(invite);
    const response = await accept();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      owner: "auth0|test-a",
      status: "accepted",
      inviteCode: null,
      role: "user",
      organization,
    });
    expect((await accept("auth0|test-b")).status).toBe(404);
    expect((await User.findById(pending._id))?.owner).toBe("auth0|test-a");
  });

  it("permits only one winner when two accounts accept simultaneously", async () => {
    const pending = await User.create(invite);
    const responses = await Promise.all([
      accept("auth0|test-a"),
      accept("auth0|test-b"),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 404]);
    const winner = responses.find((r) => r.status === 200)!;
    expect((await User.findById(pending._id))?.owner).toBe(winner.body.owner);
  });

  it("does not add a second membership or consume the code for an existing member", async () => {
    await User.create({
      organization,
      owner: "auth0|test-a",
      role: "onlyself",
    });
    const pending = await User.create(invite);
    expect((await accept()).status).toBe(409);
    expect(
      await User.countDocuments({ organization, owner: "auth0|test-a" })
    ).toBe(1);
    expect((await User.findById(pending._id))?.inviteCode).toBe(inviteCode);
  });
});
