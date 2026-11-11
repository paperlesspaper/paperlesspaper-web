import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  paper: vi.fn(),
  member: vi.fn(),
  grantCreate: vi.fn(),
  grantDelete: vi.fn(),
  grantConsume: vi.fn(),
  connectionFind: vi.fn(),
  connectionUpdate: vi.fn(),
  revoke: vi.fn(),
  accept: vi.fn(),
  content: vi.fn(),
  statusFind: vi.fn(),
}));
vi.mock("@internetderdinge/api", () => ({
  ApiError: class extends Error {
    statusCode: number;
    constructor(status: number, message: string) {
      super(message);
      this.statusCode = status;
    }
  },
  auth: () => (req: any, _res: any, next: any) => {
    req.auth = { sub: "owner" };
    next();
  },
  catchAsync: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next),
  User: { findOne: m.member },
}));
vi.mock("../../src/papers/papers.model.js", () => ({
  default: { findById: m.paper },
}));
vi.mock("../../src/cronjobs/bullmq.service.js", () => ({
  bullMqEnabled: true,
}));
vi.mock("../../src/integrationPush/models.js", () => ({
  PushGrant: {
    create: m.grantCreate,
    deleteMany: m.grantDelete,
    findOneAndDelete: m.grantConsume,
  },
  PushConnection: {
    findOne: m.connectionFind,
    findOneAndUpdate: m.connectionUpdate,
    updateMany: m.revoke,
    updateOne: m.revoke,
  },
  PushRequest: { findOne: m.statusFind },
  PushDelivery: {},
}));
vi.mock("../../src/integrationPush/content.js", () => ({
  acceptContent: m.accept,
  getIntegrationRenderContent: m.content,
  MAX_IMAGE_BYTES: 20 * 1024 * 1024,
}));
import router from "../../src/integrationPush/route.js";
import { hash } from "../../src/integrationPush/security.js";
import { integrationIdentity } from "../../src/integrationPush/access.js";
const paperId = "b".repeat(24),
  connectionId = "a".repeat(24),
  token = "t".repeat(43);
const paper = {
  _id: paperId,
  kind: "plugin",
  organization: "org",
  name: "Familie",
  meta: {
    pluginConfigUrl: "https://telegram.example/config.json",
    pluginManifest: {
      renderPage: "./render.html",
      settingsPage: "./settings.html",
      capabilities: { contentPush: { callbackPath: "/api/paper-status" } },
    },
  },
};
const connection = {
  _id: connectionId,
  paperId,
  owner: "owner",
  organization: "org",
  source: integrationIdentity(paper).source,
  revoked: false,
  tokenSecret: token,
  callbackToken: "callback",
  generation: "generation",
  tokenHash: hash(token),
};
const app = express();
app.use(express.json());
app.use(router);
app.use((err: any, _req: any, res: any, _next: any) =>
  res.status(err.statusCode || 500).json({ error: err.message })
);
beforeEach(() => {
  vi.clearAllMocks();
  m.paper.mockResolvedValue(paper);
  m.member.mockResolvedValue({});
  m.connectionFind.mockResolvedValue(connection);
  m.connectionUpdate.mockReturnValue({ select: async () => connection });
  m.statusFind.mockReturnValue({ sort: async () => null });
  m.accept.mockResolvedValue({
    _id: "request",
    paperId,
    messageId: "message",
    state: "accepted",
  });
});
it("issues a short-lived hashed paper grant without exposing permanent credentials", async () => {
  const result = await request(app).post(`/papers/${paperId}/grants`).send({
    configUrl: paper.meta.pluginConfigUrl,
    settingsPage: "https://telegram.example/settings.html",
  });
  expect(result.status).toBe(201);
  expect(Object.keys(result.body)).toEqual(["grant"]);
  expect(m.grantCreate.mock.calls[0][0]).toMatchObject({
    _id: hash(result.body.grant),
    owner: "owner",
    paperId,
  });
});
it("refuses membership loss and unsaved settings-page changes", async () => {
  m.member.mockResolvedValue(null);
  expect(
    (await request(app).post(`/papers/${paperId}/grants`).send({})).status
  ).toBe(403);
  m.member.mockResolvedValue({});
  expect(
    (
      await request(app).post(`/papers/${paperId}/grants`).send({
        configUrl: paper.meta.pluginConfigUrl,
        settingsPage: "https://evil.example/settings",
      })
    ).status
  ).toBe(409);
  expect(m.grantCreate).not.toHaveBeenCalled();
});

it("denies restricted members both new grants and existing integration connections", async () => {
  m.member.mockResolvedValue({ role: "onlyself" });
  expect(
    (
      await request(app).post(`/papers/${paperId}/grants`).send({
        configUrl: paper.meta.pluginConfigUrl,
        settingsPage: "https://telegram.example/settings.html",
      })
    ).status
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(`/connections/${connectionId}/content`)
        .set("authorization", `Bearer ${token}`)
        .send({ messageId: "restricted", text: "No access" })
    ).status
  ).toBe(403);
  expect(
    (
      await request(app)
        .get(`/connections/${connectionId}/status`)
        .set("authorization", `Bearer ${token}`)
    ).status
  ).toBe(403);
  expect(m.grantCreate).not.toHaveBeenCalled();
  expect(m.accept).not.toHaveBeenCalled();
  expect(m.member).toHaveBeenCalledWith({
    owner: "owner",
    organization: "org",
  });
});
it("exchanges a one-time grant for paper-scoped tokens and a manifest-selected callback", async () => {
  m.grantConsume.mockResolvedValue({
    owner: "owner",
    paperId,
    source: connection.source,
  });
  const result = await request(app)
    .post("/exchange")
    .send({ grant: "g".repeat(43), callbackUrl: "https://evil.example" });
  expect(result.status).toBe(200);
  expect(result.body.paperId).toBe(paperId);
  expect(m.connectionUpdate.mock.calls[0][1].$setOnInsert).toMatchObject({
    callbackUrl: "https://telegram.example/api/paper-status",
  });
  expect(result.body.token).toBe(token);
  expect(m.connectionUpdate).toHaveBeenCalledOnce();
  m.grantConsume.mockResolvedValue(null);
  expect(
    (
      await request(app)
        .post("/exchange")
        .send({ grant: "g".repeat(43) })
    ).status
  ).toBe(401);
});
it("authenticates the connection token and returns accepted instead of claiming delivery", async () => {
  const response = await request(app)
    .post(`/connections/${connectionId}/content`)
    .set("authorization", `Bearer ${token}`)
    .send({ messageId: "message", text: "Hello", paperId: "forged" });
  expect(response.status).toBe(202);
  expect(m.connectionFind).toHaveBeenCalledWith({
    _id: connectionId,
    tokenHash: hash(token),
    revoked: false,
  });
  expect(m.accept).toHaveBeenCalledWith(connection, {
    messageId: "message",
    text: "Hello",
  });
});
it("does not accept content after revocation or a manifest change", async () => {
  m.connectionFind.mockResolvedValue(null);
  expect(
    (
      await request(app)
        .post(`/connections/${connectionId}/content`)
        .set("authorization", `Bearer ${token}`)
        .send({ messageId: "x", text: "Hi" })
    ).status
  ).toBe(401);
  m.connectionFind.mockResolvedValue({ ...connection, source: "old" });
  expect(
    (
      await request(app)
        .post(`/connections/${connectionId}/content`)
        .set("authorization", `Bearer ${token}`)
        .send({ messageId: "x", text: "Hi" })
    ).status
  ).toBe(403);
  expect(m.accept).not.toHaveBeenCalled();
});
it("revokes only the current user's paper connection even when the manifest is broken", async () => {
  m.paper.mockResolvedValue(null);
  expect(
    (await request(app).delete(`/papers/${paperId}/connection`)).status
  ).toBe(204);
  expect(m.revoke).toHaveBeenCalledWith(
    { paperId, owner: "owner" },
    { $set: { revoked: true } }
  );
});

it.each(["revoked", "source changed", "legacy"])(
  "rotates connection generations after %s",
  async (reason) => {
    const old = {
      ...connection,
      revoked: reason === "revoked",
      source: reason === "source changed" ? "old-provider" : connection.source,
      generation: reason === "legacy" ? undefined : connection.generation,
    };
    m.grantConsume.mockResolvedValue({
      owner: "owner",
      paperId,
      source: connection.source,
    });
    m.connectionUpdate
      .mockReturnValueOnce({ select: async () => old })
      .mockImplementationOnce((_filter: any, update: any) => ({
        select: async () => ({ ...connection, ...update.$set }),
      }));
    const result = await request(app)
      .post("/exchange")
      .send({ grant: "g".repeat(43) });
    expect(result.status).toBe(200);
    const [filter, update] = m.connectionUpdate.mock.calls[1];
    expect(filter).toEqual({
      _id: connectionId,
      tokenHash: connection.tokenHash,
    });
    expect(update.$set.generation).toMatch(/^[\w-]{43}$/);
    expect(update.$set.generation).not.toBe(connection.generation);
    expect(result.body.token).not.toBe(token);
  }
);
it("excludes historical generations and sources from the status endpoint", async () => {
  const result = await request(app)
    .get(`/connections/${connectionId}/status`)
    .set("authorization", `Bearer ${token}`);
  expect(result.status).toBe(200);
  expect(result.body.state).toBe("empty");
  expect(m.statusFind).toHaveBeenCalledWith({
    connectionId,
    connectionGeneration: connection.generation,
    source: connection.source,
  });
});
it("does not overwrite a connection rotated by another exchange", async () => {
  m.grantConsume.mockResolvedValue({
    owner: "owner",
    paperId,
    source: connection.source,
  });
  m.connectionUpdate
    .mockReturnValueOnce({
      select: async () => ({ ...connection, revoked: true }),
    })
    .mockReturnValueOnce({ select: async () => null });
  const result = await request(app)
    .post("/exchange")
    .send({ grant: "g".repeat(43) });
  expect(result.status).toBe(409);
});

it("binds private preview responses to the renderer that authorized them", async () => {
  m.content.mockResolvedValue({ text: "Private" });
  const result = await request(app).get(`/papers/${paperId}/content`);
  expect(result.status).toBe(200);
  expect(result.body).toEqual({
    content: { text: "Private" },
    configUrl: paper.meta.pluginConfigUrl,
    renderUrl: "https://telegram.example/render.html",
  });
});
