import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@internetderdinge/api", () => ({
  auth: () => (req: any, res: any, next: any) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.auth = { sub: "auth0|signed-in" };
    next();
  },
  catchAsync: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next),
  ApiError: class extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
}));
vi.mock("../../src/batteryNotifications/batteryNotifications.model.js", () => ({
  BatteryPreference: {
    findById: (id: string) => ({ lean: () => m.read(id) }),
    updateOne: m.write,
  },
}));
import router from "../../src/batteryNotifications/batteryNotifications.route.js";
const app = express();
app.use(express.json());
app.use("/accounts", router);
app.use((error: any, _req: any, res: any, _next: any) =>
  res.status(error.statusCode || 500).json({ message: error.message })
);
const path = "/accounts/current/notifications/battery";
beforeEach(() => {
  vi.resetAllMocks();
});
it("defaults both channels off and does not create state on a read", async () => {
  const result = await request(app).get(path).set("Authorization", "mock");
  expect(result.body).toEqual({ email: false, push: false });
  expect(m.read).toHaveBeenCalledWith("auth0|signed-in");
  expect(m.write).not.toHaveBeenCalled();
  expect(result.headers["cache-control"]).toBe("no-store");
});
it("saves independent channels for the authenticated account without a push registration", async () => {
  const preference = { email: true, push: false };
  expect(
    (await request(app).put(path).set("Authorization", "mock").send(preference))
      .body
  ).toEqual(preference);
  expect(m.write).toHaveBeenCalledWith(
    { _id: "auth0|signed-in" },
    { $set: preference },
    { upsert: true }
  );
  m.read.mockResolvedValue(preference);
  expect(
    (await request(app).get(path).set("Authorization", "mock")).body
  ).toEqual(preference);
});
it.each([
  { email: "true", push: false },
  { email: true },
  { email: true, push: false, user: "other" },
  { email: true, push: true, notification: {} },
])("rejects invalid preferences and user overrides: %j", async (body) => {
  expect(
    (await request(app).put(path).set("Authorization", "mock").send(body))
      .status
  ).toBe(400);
  expect(m.write).not.toHaveBeenCalled();
});
it.each(["get", "put"] as const)("requires login for %s", async (method) => {
  expect((await request(app)[method](path)).status).toBe(401);
  expect(m.read).not.toHaveBeenCalled();
  expect(m.write).not.toHaveBeenCalled();
});
it("rejects API keys even alongside a bearer credential", async () => {
  expect(
    (
      await request(app)
        .put(path)
        .set("X-API-Key", "mock")
        .set("Authorization", "mock")
        .send({ email: true, push: true })
    ).status
  ).toBe(403);
  expect(m.write).not.toHaveBeenCalled();
});
it("returns storage errors instead of claiming preferences were saved", async () => {
  m.write.mockRejectedValue(new Error("database unavailable"));
  expect(
    (
      await request(app)
        .put(path)
        .set("Authorization", "mock")
        .send({ email: true, push: false })
    ).status
  ).toBe(500);
});
