import express from "express";
import request from "supertest";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  paper: {
    id: "paper",
    _id: "paper",
    deviceId: "device",
    kind: "image",
    meta: {},
  },
  device: { id: "device", deviceId: "FRAME", kind: "epd7", meta: {} },
  update: vi.fn(),
  shadow: vi.fn(),
  upload: vi.fn(),
  sync: vi.fn(),
  resize: vi.fn(),
  dither: vi.fn(),
}));
vi.mock("@internetderdinge/api", async () => {
  const { z } = await import("zod");
  const { extendZodWithOpenApi, OpenAPIRegistry } = await import(
    "@asteasolutions/zod-to-openapi"
  );
  extendZodWithOpenApi(z);
  const { validateZod } = await import(
    "../../../../node_modules/@internetderdinge/api/src/middlewares/validateZod"
  );
  const { default: ApiError } = await import(
    "../../../../node_modules/@internetderdinge/api/src/utils/ApiError"
  );
  return {
    ApiError,
    validateZod,
    catchAsync: (fn: any) => (req: any, res: any, next: any) =>
      Promise.resolve(fn(req, res, next)).catch(next),
    devicesService: { getById: async () => m.device },
    iotDevicesService: { shadowAlarmUpdate: m.shadow },
    Token: {},
    createToken: vi.fn(),
    pick: vi.fn(),
    auth: () => (_req: any, _res: any, next: any) => next(),
    validateDeviceIsInOrganization: vi.fn(),
    validateDeviceOrOrganizationQuery: vi.fn(),
    buildRouterAndDocs: vi.fn(),
    registry: new OpenAPIRegistry(),
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
vi.mock("../../src/papers/papers.service", () => ({
  default: {
    getById: async () => m.paper,
    updateById: m.update,
    markCurrentFrameImageSyncPending: m.sync,
  },
}));
vi.mock("../../src/iotdevice/iotdevice.service", () => ({
  default: { uploadSingleImage: m.upload },
}));
vi.mock("../../src/render/render.service", () => ({
  default: { resizeImageToDeviceSize: m.resize, ditherImage: m.dither },
}));
vi.mock("../../src/papers/googleCalendar.service", () => ({ default: {} }));
vi.mock("../../src/papers/fetchEditableImage", () => ({
  fetchEditableImage: vi.fn(),
}));
import router from "../../src/papers/papers.route";
import { registry } from "@internetderdinge/api";
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import {
  PICTURE_DEVICE_MAX_BYTES,
  validatePictureDevice,
} from "../../src/papers/pictureDevice";
import { imageUploadResponseSchema } from "../../src/papers/papers.schemas";
const app = express()
  .use(router)
  .use((error: any, _req: any, res: any, _next: any) => {
    res.status(error.statusCode || 500).json({
      code: error.statusCode || 500,
      message: error.message,
      raw: error.raw || null,
    });
  });
const post = () => request(app).post("/uploadSingleImage/paper");
const image = (width = 800, height = 480) =>
  sharp({ create: { width, height, channels: 4, background: "red" } });
const resultBody = {
  similarityPercentage: null,
  skippedUpload: false,
  uploadFailed: false,
  uploadAttemptId: "attempt",
  reason: "device-frame-uploaded",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.paper.kind = "image";
  m.device.kind = "epd7";
  m.update.mockResolvedValue(m.paper);
  m.upload.mockResolvedValue(resultBody);
});
describe("pictureDevice uploads through the router", () => {
  it.each(["png", "jpeg"] as const)(
    "accepts %s by content and preserves its exact bytes",
    async (format) => {
      const buffer = await image().toFormat(format).toBuffer();
      const res = await post()
        .field("forceUpload", "true")
        .attach("pictureDevice", buffer, {
          filename: "wrong.extension",
          contentType: "application/octet-stream",
        });
      expect(res.status).toBe(200);
      expect(imageUploadResponseSchema.safeParse(res.body).success).toBe(true);
      expect(m.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer,
          bufferOriginal: buffer,
          forceUpload: true,
        })
      );
      expect(m.resize).not.toHaveBeenCalled();
      expect(m.dither).not.toHaveBeenCalled();
    }
  );
  it("accepts Paper 13 native panel size", async () => {
    m.device.kind = "openpaper13";
    expect(
      (
        await post().attach(
          "pictureDevice",
          await image(1600, 1200).png().toBuffer(),
          "frame.png"
        )
      ).status
    ).toBe(200);
  });
  it("uses picture for the preview when both fields are sent", async () => {
    const buffer = await image().png().toBuffer(),
      original = await image(480, 800).jpeg().toBuffer();
    expect(
      (
        await post()
          .attach("picture", original, "original.jpg")
          .attach("pictureDevice", buffer, "frame.png")
      ).status
    ).toBe(200);
    expect(m.upload).toHaveBeenCalledWith(
      expect.objectContaining({ buffer, bufferOriginal: original })
    );
  });
  it.each([
    [480, 800],
    [799, 480],
    [1600, 1200],
  ])("rejects %sx%s before any side effect", async (w, h) => {
    const res = await post()
      .field("settings", '{"orientation":"portrait"}')
      .attach("pictureDevice", await image(w, h).png().toBuffer(), "frame.png");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("800x480");
    for (const fn of [m.update, m.shadow, m.upload, m.sync])
      expect(fn).not.toHaveBeenCalled();
  });
  it("rejects unsupported formats despite a PNG filename", async () => {
    const res = await post().attach(
      "pictureDevice",
      await image().webp().toBuffer(),
      "frame.png"
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("PNG and JPEG only");
  });
  it("rejects corrupt pixels even with a readable header", async () => {
    const buffer = await image().png().toBuffer();
    const truncated = buffer.subarray(0, Math.floor(buffer.length / 2));
    expect((await sharp(truncated).metadata()).width).toBe(800);
    expect(
      (await post().attach("pictureDevice", truncated, "frame.png")).status
    ).toBe(400);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("rejects empty files, non-images and EXIF rotation", async () => {
    for (const buffer of [
      Buffer.alloc(0),
      Buffer.from("not an image"),
      await image().jpeg().withMetadata({ orientation: 6 }).toBuffer(),
    ]) {
      expect(
        (await post().attach("pictureDevice", buffer, "frame.jpg")).status
      ).toBe(400);
    }
  });
  it("returns 413 above 10 MiB during multipart parsing", async () => {
    const res = await post().attach(
      "pictureDevice",
      Buffer.alloc(PICTURE_DEVICE_MAX_BYTES + 1),
      "frame.png"
    );
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({
      code: 413,
      message: "pictureDevice must not exceed 10 MiB.",
    });
    expect(m.shadow).not.toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("accepts exactly 10 MiB and leaves the picture limit unchanged", async () => {
    const buffer = await image().png().toBuffer();
    const padded = Buffer.concat([
      buffer,
      Buffer.alloc(PICTURE_DEVICE_MAX_BYTES - buffer.length),
    ]);
    expect(
      (await post().attach("pictureDevice", padded, "frame.png")).status
    ).toBe(200);
    expect(
      (
        await post()
          .attach("pictureDevice", buffer, "frame.png")
          .attach(
            "picture",
            Buffer.alloc(PICTURE_DEVICE_MAX_BYTES + 1),
            "source.png"
          )
      ).status
    ).toBe(200);
  });
  it("returns 400 for duplicate files and a text pictureDevice", async () => {
    const buffer = await image().png().toBuffer();
    expect(
      (
        await post()
          .attach("pictureDevice", buffer, "a.png")
          .attach("pictureDevice", buffer, "b.png")
      ).status
    ).toBe(400);
    expect((await post().field("pictureDevice", "true")).status).toBe(400);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("rejects non-image papers and unknown panel sizes", async () => {
    const buffer = await image().png().toBuffer();
    m.paper.kind = "calendar";
    expect(
      (await post().attach("pictureDevice", buffer, "frame.png")).status
    ).toBe(400);
    await expect(
      validatePictureDevice(buffer, "unknown")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(m.shadow).not.toHaveBeenCalled();
  });
  it("preserves source-only and legacy two-picture uploads", async () => {
    const original = await image(30, 40).png().toBuffer(),
      buffer = await image().png().toBuffer();
    m.resize.mockResolvedValue({ buffer: original, size: {} });
    m.dither.mockResolvedValue({ buffer });
    expect(
      (await post().attach("picture", original, "source.png")).status
    ).toBe(200);
    expect(m.resize).toHaveBeenCalled();
    m.resize.mockClear();
    expect(
      (
        await post()
          .attach("picture", buffer, "frame.png")
          .attach("picture", original, "source.png")
      ).status
    ).toBe(200);
    expect(m.resize).not.toHaveBeenCalled();
    expect(m.upload).toHaveBeenLastCalledWith(
      expect.objectContaining({ buffer, bufferOriginal: original })
    );
  });
});

it("generates the actual upload OpenAPI contract", () => {
  const document = new OpenApiGeneratorV3(
    registry.definitions
  ).generateDocument({
    openapi: "3.0.0",
    info: { title: "Test", version: "1" },
  });
  const endpoint = document.paths["/papers/uploadSingleImage/{paperId}"].post!;
  const schema = endpoint.responses[200].content["application/json"].schema;
  expect(schema.properties).toHaveProperty("similarityPercentage");
  expect(schema.properties).toHaveProperty("skippedUpload");
  expect(endpoint.responses).toHaveProperty("400");
  expect(endpoint.responses).toHaveProperty("413");
});
