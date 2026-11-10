import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
const access = vi.hoisted(() => ({ auth: vi.fn(), organization: vi.fn() }));
vi.mock("@internetderdinge/api", async () => {
  const { z } = await import("zod");
  const { extendZodWithOpenApi } = await import(
    "@asteasolutions/zod-to-openapi"
  );
  extendZodWithOpenApi(z);
  const { validateZod } = await import(
    "../../../../node_modules/@internetderdinge/api/src/middlewares/validateZod"
  );
  const { default: buildRouterAndDocs } = await import(
    "../../../../node_modules/@internetderdinge/api/src/utils/buildRouterAndDocs"
  );
  return {
    validateZod,
    buildRouterAndDocs,
    auth: () => (req: any, res: any, next: any) => {
      access.auth();
      req.headers.authorization ? next() : res.sendStatus(401);
    },
    validateDeviceOrOrganizationQuery: (req: any, res: any, next: any) => {
      access.organization();
      req.headers["x-test-membership"] === "yes" ? next() : res.sendStatus(403);
    },
    validateDeviceIsInOrganization: (_req: any, _res: any, next: any) => next(),
    registry: { registerPath: vi.fn() },
    bearerAuth: { name: "bearer" },
    xApiKey: { name: "key" },
    zObjectId: z.string(),
    zObjectIdFor: () => z.string(),
    zPagination: { query: z.object({}) },
    zPaginationResponse: () => z.object({}),
  };
});
vi.mock("../../src/middlewares/validatePaper", () => ({
  validatePaper: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../../src/papers/papers.controller", () =>
  Object.fromEntries(
    [
      "storageUsage",
      "createEntry",
      "previewLayout",
      "queryPapersByDevice",
      "getEntry",
      "updateEntry",
      "deleteEntry",
      "uploadSingleImageFromWebsite",
      "getCalendarByEntry",
      "getCalendarPreview",
      "generateSignedFileUrl",
      "uploadSingleImage",
      "createPluginRedirectToken",
      "redeemPluginRedirectToken",
    ].map((name) => [
      name,
      (req: any, res: any) =>
        res.json({ settings: req.body, mode: req.query.mode }),
    ])
  )
);
import router from "../../src/papers/papers.route";
const app = express()
  .use(express.json())
  .use(router)
  .use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode || 500).json({ message: error.message })
  );
const organization = "a".repeat(24);
const body = {
  layout: "columns",
  ratio: 2,
  gap: 8,
  regions: [
    { id: "left", paperId: "b".repeat(24) },
    { id: "right", paperId: "c".repeat(24) },
  ],
};
const post = (mode = "resolve") =>
  request(app).post(
    `/layout-preview?organization=${organization}&mode=${mode}`
  );
describe("layout preview HTTP validation", () => {
  it.each(["resolve", "render"])(
    "accepts a valid %s body through the real router and Zod chain",
    async (mode) => {
      const result = await post(mode)
        .set("Authorization", "test")
        .set("x-test-membership", "yes")
        .send(body);
      expect(result.status).toBe(200);
      expect(result.body.settings.regions).toHaveLength(2);
      expect(access.auth).toHaveBeenCalled();
      expect(access.organization).toHaveBeenCalled();
    }
  );
  it("retains authentication and organization middleware", async () => {
    expect((await post().send(body)).status).toBe(401);
    expect((await post().set("Authorization", "test").send(body)).status).toBe(
      403
    );
  });
  it("rejects invalid settings and deviceId query bypasses", async () => {
    expect((await post().send({ ...body, gap: -1 })).status).toBe(400);
    expect(
      (
        await request(app)
          .post(
            `/layout-preview?organization=${organization}&deviceId=${"b".repeat(
              24
            )}`
          )
          .send(body)
      ).status
    ).toBe(400);
  });
});

describe("storage usage authorization", () => {
  it("requires authentication and organization membership", async () => {
    expect(
      (await request(app).get(`/storage-usage?organization=${organization}`))
        .status
    ).toBe(401);
    expect(
      (
        await request(app)
          .get(`/storage-usage?organization=${organization}`)
          .set("Authorization", "test")
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(`/storage-usage?organization=${organization}`)
          .set("Authorization", "test")
          .set("x-test-membership", "yes")
      ).status
    ).toBe(200);
  });
  it("rejects deviceId so device membership cannot bypass organization authorization", async () => {
    const response = await request(app)
      .get(
        `/storage-usage?organization=${organization}&deviceId=${"b".repeat(24)}`
      )
      .set("Authorization", "test")
      .set("x-test-membership", "yes");
    expect(response.status).toBe(400);
  });
});
