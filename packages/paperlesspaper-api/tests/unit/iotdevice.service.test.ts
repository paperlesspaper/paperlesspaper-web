import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const uploadParams = vi.hoisted(() => [] as any[]);
const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const compareImagesMock = vi.hoisted(() => vi.fn());

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
  getSignedFileUrl: vi.fn(async ({ fileName }: { fileName: string }) => {
    return `https://signed.invalid/${encodeURIComponent(fileName)}`;
  }),
}));

describe("iotdevice.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadParams.length = 0;

    process.env.AUTH0_MANAGEMENT_DOMAIN = "auth.invalid";
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = "client-id";
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = "client-secret";
    process.env.AWS_ACCESS_KEY_ID = "access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "secret-key";
    process.env.AWS_S3_BUCKET_NAME = "bucket";
    process.env.IOT_API_URL_EPAPER = "https://iot.invalid/";

    axiosMock.get.mockRejectedValue(new Error("No previous original"));
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
    });

    const uploadedByKey = new Map(
      uploadParams.map((params) => [params.Key, params]),
    );

    expect(uploadedByKey.has("ePaperImages/paper-1.png")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1original.jpg")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1original.png")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1thumbnail.jpg")).toBe(true);

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
  });

  it("forces the physical upload even when the stored paper image is similar", async () => {
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
});
