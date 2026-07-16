import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const uploadParams = vi.hoisted(() => [] as any[]);
const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const compareImagesMock = vi.hoisted(() => vi.fn());
const saveDeviceUploadLogMock = vi.hoisted(() => vi.fn(async () => true));
const getSignedFileUrlMock = vi.hoisted(() =>
  vi.fn(async ({ fileName }: { fileName: string }) => {
    return `https://signed.invalid/${encodeURIComponent(fileName)}`;
  }),
);

vi.mock("../../src/devicesLogs/devicesLogs.service.js", () => ({
  sanitizeDeviceLogValue: (value: unknown) => value,
  saveDeviceUploadLog: saveDeviceUploadLogMock,
  serializeDeviceLogError: (error: unknown) => ({
    name: error instanceof Error ? error.name : undefined,
    message: error instanceof Error ? error.message : String(error),
    httpStatus: (error as any)?.response?.status,
  }),
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class Upload {
    params: any;

    constructor(params: any) {
      this.params = params;
      uploadParams.push(params.params);
    }

    async done() {
      return undefined;
    }
  },
}));

vi.mock("auth0", () => ({
  AuthenticationClient: vi.fn(function AuthenticationClient() {
    return {
      oauth: {
        clientCredentialsGrant: vi.fn(async () => ({
          data: { access_token: "test-token", expires_in: 3600 },
        })),
      },
    };
  }),
}));

vi.mock("axios", () => ({
  __esModule: true,
  default: axiosMock,
}));

vi.mock("@internetderdinge/api", () => ({
  SIMILARITY_THRESHOLD: 99.995,
  compareImages: compareImagesMock,
  getSignedFileUrl: getSignedFileUrlMock,
}));

describe("iotdevice.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadParams.length = 0;
    saveDeviceUploadLogMock.mockResolvedValue(true);

    process.env.AUTH0_MANAGEMENT_DOMAIN = "auth.invalid";
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = "client-id";
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = "client-secret";
    process.env.AWS_ACCESS_KEY_ID = "access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "secret-key";
    process.env.AWS_S3_BUCKET_NAME = "bucket";
    process.env.IOT_API_URL_EPAPER = "https://iot.invalid/";

    axiosMock.get.mockRejectedValue(
      Object.assign(new Error("No previous device image"), {
        response: { status: 404 },
      }),
    );
    axiosMock.post.mockResolvedValue({
      data: { uploadURL: "https://upload.invalid/device-image" },
    });
    axiosMock.put.mockResolvedValue({ status: 200 });
    compareImagesMock.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores JPG originals, a temporary PNG original, and a thumbnail without changing the e-paper upload buffer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const originalBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const deviceBuffer = Buffer.from("device-ready-buffer");

    const service = await import("../../src/iotdevice/iotdevice.service");

    await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: deviceBuffer,
      bufferOriginal: originalBuffer,
      id: "paper-1",
      trigger: "unit-test-manual-upload",
    });

    const uploadedByKey = new Map(
      uploadParams.map((params) => [params.Key, params]),
    );

    expect(uploadedByKey.has("ePaperImages/paper-1.png")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1original.jpg")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1original.png")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1thumbnail.jpg")).toBe(true);
    expect(uploadedByKey.has("ePaperDeviceImages/device-1.png")).toBe(true);

    expect(
      uploadedByKey.get("ePaperImages/paper-1original.jpg")?.ContentType,
    ).toBe("image/jpeg");
    expect(
      uploadedByKey.get("ePaperImages/paper-1original.png")?.ContentType,
    ).toBe("image/png");
    expect(
      uploadedByKey.get("ePaperImages/paper-1thumbnail.jpg")?.ContentType,
    ).toBe("image/jpeg");

    const originalMetadata = await sharp(
      uploadedByKey.get("ePaperImages/paper-1original.jpg")?.Body,
    ).metadata();
    expect(originalMetadata.format).toBe("jpeg");
    expect(originalMetadata.width).toBe(800);
    expect(originalMetadata.height).toBe(600);

    const temporaryOriginalPng = uploadedByKey.get(
      "ePaperImages/paper-1original.png",
    )?.Body;
    const temporaryOriginalMetadata =
      await sharp(temporaryOriginalPng).metadata();
    expect(temporaryOriginalMetadata.format).toBe("png");
    expect(Buffer.from(temporaryOriginalPng).equals(originalBuffer)).toBe(true);

    const thumbnailMetadata = await sharp(
      uploadedByKey.get("ePaperImages/paper-1thumbnail.jpg")?.Body,
    ).metadata();
    expect(Math.min(thumbnailMetadata.width!, thumbnailMetadata.height!)).toBe(
      500,
    );

    expect(axiosMock.put).toHaveBeenCalledWith(
      "https://upload.invalid/device-image",
      deviceBuffer,
      expect.objectContaining({
        headers: { "Content-Type": "text/octet-stream" },
      }),
    );
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deviceName: "device-1",
        paperId: "paper-1",
        trigger: "unit-test-manual-upload",
        status: "uploaded",
        reason: "device-frame-uploaded",
        similarityPercentage: null,
        durationMs: expect.any(Number),
        decision: expect.objectContaining({
          action: "upload",
          reason: "previous-device-image-not-found",
        }),
        stages: expect.objectContaining({
          iotPut: expect.objectContaining({ status: "completed" }),
          deviceImageSnapshot: expect.objectContaining({
            status: "completed",
            key: "ePaperDeviceImages/device-1.png",
          }),
        }),
      }),
    );
  });

  it("forces the physical upload even when the stored device image is similar", async () => {
    const originalBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const deviceBuffer = Buffer.from("device-ready-buffer");

    axiosMock.get.mockResolvedValue({ data: Buffer.from("previous-original") });
    compareImagesMock.mockResolvedValue(100);

    const service = await import("../../src/iotdevice/iotdevice.service");

    const result = await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: deviceBuffer,
      bufferOriginal: originalBuffer,
      id: "paper-1",
      forceUpload: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        skippedUpload: false,
        similarityPercentage: null,
      }),
    );
    expect(compareImagesMock).not.toHaveBeenCalled();
    expect(axiosMock.put).toHaveBeenCalledWith(
      "https://upload.invalid/device-image",
      deviceBuffer,
      expect.objectContaining({
        headers: { "Content-Type": "text/octet-stream" },
      }),
    );
  });

  it("skips the physical upload when the same device already has a similar dithered frame", async () => {
    const previousDeviceBuffer = Buffer.from("previous-device-buffer");
    const deviceBuffer = Buffer.from("device-ready-buffer");

    axiosMock.get.mockResolvedValue({ data: previousDeviceBuffer });
    compareImagesMock.mockResolvedValue(100);

    const service = await import("../../src/iotdevice/iotdevice.service");

    const result = await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: deviceBuffer,
      bufferOriginal: deviceBuffer,
      id: "paper-1",
    });

    expect(getSignedFileUrlMock).toHaveBeenCalledWith({
      fileName: "ePaperDeviceImages/device-1.png",
    });
    expect(compareImagesMock).toHaveBeenCalledWith(
      previousDeviceBuffer,
      deviceBuffer,
    );
    expect(result).toEqual(
      expect.objectContaining({
        skippedUpload: true,
        similarityPercentage: 100,
      }),
    );
    expect(axiosMock.post).not.toHaveBeenCalled();
    expect(axiosMock.put).not.toHaveBeenCalled();
    expect(uploadParams).toHaveLength(0);
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deviceName: "device-1",
        paperId: "paper-1",
        status: "skipped",
        reason: "similarity-threshold-met",
        similarityPercentage: 100,
        decision: expect.objectContaining({ action: "skip" }),
        stages: expect.objectContaining({
          paperImages: expect.objectContaining({ status: "not-run" }),
          iotPut: expect.objectContaining({ status: "not-run" }),
        }),
      }),
    );
  });

  it("does not update the stored device frame when the IoT upload fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    axiosMock.put.mockRejectedValue(new Error("IoT PUT failed"));

    const originalBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const deviceBuffer = Buffer.from("device-ready-buffer");
    const service = await import("../../src/iotdevice/iotdevice.service");

    await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: deviceBuffer,
      bufferOriginal: originalBuffer,
      id: "paper-1",
    });

    expect(
      uploadParams.some(
        (params) => params.Key === "ePaperDeviceImages/device-1.png",
      ),
    ).toBe(false);
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deviceName: "device-1",
        status: "failed",
        reason: "iot-upload-failed",
        failures: expect.arrayContaining([
          expect.objectContaining({
            stage: "iot-upload",
            message: "IoT PUT failed",
          }),
        ]),
      }),
    );
  });

  it("logs a failed attempt when the IoT API omits the upload URL", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    axiosMock.post.mockResolvedValue({
      status: 200,
      data: { message: "No upload URL available" },
    });

    const originalBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const service = await import("../../src/iotdevice/iotdevice.service");

    const result = await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: Buffer.from("device-ready-buffer"),
      bufferOriginal: originalBuffer,
      id: "paper-1",
      trigger: "cronjob-dynamic-integration",
    });

    expect(result).toEqual(
      expect.objectContaining({
        skippedUpload: false,
        reason: "iot-upload-url-missing",
      }),
    );
    expect(axiosMock.put).not.toHaveBeenCalled();
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trigger: "cronjob-dynamic-integration",
        status: "failed",
        reason: "iot-upload-url-missing",
        stages: expect.objectContaining({
          iotUploadRequest: expect.objectContaining({
            status: "failed",
            reason: "missing-upload-url",
          }),
          iotPut: expect.objectContaining({ status: "not-run" }),
        }),
      }),
    );
  });

  it("continues the upload when database logging is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveDeviceUploadLogMock.mockRejectedValue(new Error("Mongo unavailable"));

    const originalBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const service = await import("../../src/iotdevice/iotdevice.service");

    const result = await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: Buffer.from("device-ready-buffer"),
      bufferOriginal: originalBuffer,
      id: "paper-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        skippedUpload: false,
        reason: "device-frame-uploaded",
      }),
    );
    expect(axiosMock.put).toHaveBeenCalledOnce();
  });
});
