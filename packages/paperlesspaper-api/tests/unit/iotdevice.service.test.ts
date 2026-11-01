import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const uploadParams = vi.hoisted(() => [] as any[]);
const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const compareImagesMock = vi.hoisted(() => vi.fn());
const cacheDeleteMock = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      send = cacheDeleteMock;
      destroy() {}
    },
  };
});
const saveDeviceUploadLogMock = vi.hoisted(() => vi.fn(async () => true));
const getSignedFileUrlMock = vi.hoisted(() =>
  vi.fn(async ({ fileName }: { fileName: string }) => {
    return `https://signed.invalid/${encodeURIComponent(fileName)}`;
  })
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
  it("uploads the first frame for a new ownership assignment even if the previous owner's cached frame matches", async () => {
    const frame = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    axiosMock.get.mockResolvedValue({ data: frame });
    compareImagesMock.mockResolvedValue(100);
    const service = await import("../../src/iotdevice/iotdevice.service");
    const { resetDeviceImageCache } = await import(
      "../../src/iotdevice/deviceImageCache"
    );
    cacheDeleteMock.mockImplementationOnce(async (command) => {
      expect(command.input).toEqual({
        Bucket: "bucket",
        Key: "ePaperDeviceImages/epd7-transferred.png",
      });
      axiosMock.get.mockRejectedValue(
        Object.assign(new Error("No previous device image"), {
          response: { status: 404 },
        })
      );
    });
    await resetDeviceImageCache("epd7-transferred");
    expect(cacheDeleteMock).toHaveBeenCalledOnce();
    // IoT clears its epdPicture on takeover. Registration also clears the
    // serial-keyed comparison image before this first upload.
    const result = await service.uploadSingleImage({
      deviceName: "epd7-transferred",
      deviceId: "new-owner-device-id",
      id: "new-owner-paper-id",
      buffer: frame,
      bufferOriginal: frame,
    });
    expect(result.skippedUpload).toBe(false);
    expect(axiosMock.put).toHaveBeenCalledOnce();
  });
  it("rejects a revoked assignment before any image write or IoT request", async () => {
    const frame = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
    const service = await import("../../src/iotdevice/iotdevice.service");
    const result = await service.uploadSingleImage({ deviceName: "FRAME-A", deviceId: "db-A", id: "paper-A", buffer: frame,
      beforeUpload: async () => { throw new Error("assignment changed"); } });
    expect(result).toBeNull();
    expect(uploadParams).toHaveLength(0);
    expect(axiosMock.post).not.toHaveBeenCalled();
    expect(axiosMock.put).not.toHaveBeenCalled();
  });

  it("rechecks after the signed URL arrives and refuses the PUT if ownership changed", async () => {
    const frame = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
    let allowed = true;
    axiosMock.post.mockImplementationOnce(async () => { allowed = false; return { data: { uploadURL: "https://upload.invalid/FRAME-A" } }; });
    const service = await import("../../src/iotdevice/iotdevice.service");
    const result = await service.uploadSingleImage({ deviceName: "FRAME-A", deviceId: "db-A", id: "paper-A", buffer: frame,
      beforeUpload: async () => { if (!allowed) throw new Error("assignment changed"); } });
    expect(axiosMock.post).toHaveBeenCalledOnce();
    expect(axiosMock.post.mock.calls[0][1]).toEqual({ deviceName: "FRAME-A" });
    expect(axiosMock.put).not.toHaveBeenCalled();
    expect(result.uploadFailed).toBe(true);
    expect(uploadParams.some(p => p.Key?.startsWith("ePaperDeviceImages/"))).toBe(false);
  });

  it("keeps concurrent image requests and cached frames separated by physical device", async () => {
    const service = await import("../../src/iotdevice/iotdevice.service");
    const frames = await Promise.all(["white", "black"].map(background => sharp({ create: { width: 8, height: 8, channels: 3, background } }).png().toBuffer()));
    axiosMock.post.mockImplementation(async (_url, data) => ({ data: { uploadURL: `https://upload.invalid/${data.deviceName}` } }));
    const guard = vi.fn().mockResolvedValue(undefined);
    await Promise.all(["FRAME-A", "FRAME-B"].map((name, i) => service.uploadSingleImage({ deviceName: name, deviceId: `db-${name}`, id: `paper-${name}`, buffer: frames[i], beforeUpload: guard })));
    expect(axiosMock.put).toHaveBeenCalledTimes(2);
    for (const [i, name] of ["FRAME-A", "FRAME-B"].entries()) {
      const put = axiosMock.put.mock.calls.find(([url]) => url.endsWith(name));
      expect(put?.[1]).toEqual(frames[i]);
      expect(uploadParams.find(p => p.Key === `ePaperDeviceImages/${name}.png`)?.Body).toEqual(frames[i]);
    }
    expect(guard).toHaveBeenCalledTimes(10);
    expect(guard.mock.calls.filter(([verifyRemoteOwner]) => verifyRemoteOwner === true)).toHaveLength(4);
  });

  it("does not restore a previous owner's device cache when ownership changes during an in-flight PUT", async () => {
    const frame = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
    let allowed = true;
    axiosMock.put.mockImplementationOnce(async () => { allowed = false; return { status: 200 }; });
    const service = await import("../../src/iotdevice/iotdevice.service");
    const result = await service.uploadSingleImage({ deviceName: "FRAME-A", deviceId: "db-A", id: "paper-A", buffer: frame,
      beforeUpload: async () => { if (!allowed) throw new Error("assignment changed during PUT"); } });
    expect(axiosMock.put).toHaveBeenCalledOnce(); // Already in flight: cannot retract this transfer.
    expect(uploadParams.some(p => p.Key?.startsWith("ePaperDeviceImages/"))).toBe(false);
    expect(result.reason).toBe("device-frame-uploaded-snapshot-failed");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cacheDeleteMock.mockReset().mockResolvedValue({});
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
      })
    );
    axiosMock.post.mockResolvedValue({
      data: { uploadURL: "https://upload.invalid/device-image" },
    });
    axiosMock.put.mockResolvedValue({ status: 200 });
    compareImagesMock.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aborts a hung IoT request, records the failed stage, and allows the next upload", async () => {
    const original = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const service = await import("../../src/iotdevice/iotdevice.service");
    let requestSignal: AbortSignal | undefined;
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    axiosMock.post.mockImplementationOnce((_url, _data, options) => {
      requestSignal = options.signal;
      requestStarted();
      return new Promise(() => {});
    });
    vi.useFakeTimers();
    const upload = service.uploadSingleImage({
      deviceName: "device-1",
      buffer: original,
      id: "paper-1",
    });
    await started;
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stages: expect.objectContaining({
          iotUploadRequest: { status: "started" },
        }),
      })
    );
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await upload;
    expect(requestSignal?.aborted).toBe(true);
    expect(result.uploadFailed).toBe(true);
    expect(axiosMock.put).not.toHaveBeenCalled();
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed" })
    );
    vi.useRealTimers();
    await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: original,
      id: "paper-1",
    });
    expect(axiosMock.put).toHaveBeenCalledOnce();
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
      attemptStartedAt: new Date(Date.now() - 1_000),
      pipeline: {
        source: "unit-test",
        timings: {
          controllerSetupMs: 25,
          deviceShadowSettingsMs: 300,
        },
      },
      render: {
        renderer: "puppeteer",
        outcome: "success",
        startedAt: "2026-07-17T10:00:00.000Z",
        finishedAt: "2026-07-17T10:00:01.250Z",
        durationMs: 1250,
        url: "https://apps.paperlesspaper.de/simple-text/",
        viewport: {
          width: 800,
          height: 480,
          orientation: "landscape",
          kind: "epd7",
        },
        initPayloadSent: true,
        legacyDataPayloadSent: false,
        networkIdle: { outcome: "idle" },
        readiness: {
          outcome: "website-has-loaded",
          protocolDetected: true,
          loadingElementDetectedBeforeInit: true,
          loadedElementDetectedBeforeInit: false,
          loadingElementDetectedAfterInit: true,
          loadedElementDetectedAfterInit: false,
          websiteHasLoadedDetected: true,
          selector: "#website-has-loaded",
          timeoutMs: 15000,
          waitDurationMs: 220,
        },
        pageState: { status: "ready", hasErrorElement: false },
        timings: { totalMs: 1250, readinessWaitMs: 220 },
      },
    });

    const uploadedByKey = new Map(
      uploadParams.map((params) => [params.Key, params])
    );

    expect(uploadedByKey.has("ePaperImages/paper-1.png")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1original.jpg")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1original.png")).toBe(true);
    expect(uploadedByKey.has("ePaperImages/paper-1thumbnail.jpg")).toBe(true);
    expect(uploadedByKey.has("ePaperDeviceImages/device-1.png")).toBe(true);

    expect(
      uploadedByKey.get("ePaperImages/paper-1original.jpg")?.ContentType
    ).toBe("image/jpeg");
    expect(
      uploadedByKey.get("ePaperImages/paper-1original.png")?.ContentType
    ).toBe("image/png");
    expect(
      uploadedByKey.get("ePaperImages/paper-1thumbnail.jpg")?.ContentType
    ).toBe("image/jpeg");

    const originalMetadata = await sharp(
      uploadedByKey.get("ePaperImages/paper-1original.jpg")?.Body
    ).metadata();
    expect(originalMetadata.format).toBe("jpeg");
    expect(originalMetadata.width).toBe(800);
    expect(originalMetadata.height).toBe(600);

    const temporaryOriginalPng = uploadedByKey.get(
      "ePaperImages/paper-1original.png"
    )?.Body;
    const temporaryOriginalMetadata = await sharp(
      temporaryOriginalPng
    ).metadata();
    expect(temporaryOriginalMetadata.format).toBe("png");
    expect(Buffer.from(temporaryOriginalPng).equals(originalBuffer)).toBe(true);

    const thumbnailMetadata = await sharp(
      uploadedByKey.get("ePaperImages/paper-1thumbnail.jpg")?.Body
    ).metadata();
    expect(Math.min(thumbnailMetadata.width!, thumbnailMetadata.height!)).toBe(
      500
    );

    expect(axiosMock.put).toHaveBeenCalledWith(
      "https://upload.invalid/device-image",
      deviceBuffer,
      expect.objectContaining({
        headers: { "Content-Type": "text/octet-stream" },
      })
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
        pipeline: expect.objectContaining({
          source: "unit-test",
          timings: expect.objectContaining({
            controllerSetupMs: 25,
            deviceShadowSettingsMs: 300,
            preUploadMs: expect.any(Number),
            uploadMs: expect.any(Number),
            totalMs: expect.any(Number),
          }),
        }),
        render: expect.objectContaining({
          renderer: "puppeteer",
          durationMs: 1250,
          readiness: expect.objectContaining({
            outcome: "website-has-loaded",
            waitDurationMs: 220,
          }),
        }),
        decision: expect.objectContaining({
          action: "upload",
          reason: "previous-device-image-not-found",
        }),
        stages: expect.objectContaining({
          similarity: expect.objectContaining({
            status: "completed",
            durationMs: expect.any(Number),
          }),
          paperImages: expect.objectContaining({
            status: "completed",
            durationMs: expect.any(Number),
          }),
          iotUploadRequest: expect.objectContaining({
            status: "completed",
            durationMs: expect.any(Number),
          }),
          iotPut: expect.objectContaining({
            status: "completed",
            durationMs: expect.any(Number),
          }),
          deviceImageSnapshot: expect.objectContaining({
            status: "completed",
            key: "ePaperDeviceImages/device-1.png",
            durationMs: expect.any(Number),
          }),
        }),
      })
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
      })
    );
    expect(compareImagesMock).not.toHaveBeenCalled();
    expect(axiosMock.put).toHaveBeenCalledWith(
      "https://upload.invalid/device-image",
      deviceBuffer,
      expect.objectContaining({
        headers: { "Content-Type": "text/octet-stream" },
      })
    );
  });

  it("stores a new slideshow's previews while skipping an identical physical frame", async () => {
    const previousDeviceBuffer = Buffer.from("previous-device-buffer");
    const deviceBuffer = Buffer.from("device-ready-buffer");
    const originalBuffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "white" },
    }).png().toBuffer();

    axiosMock.get.mockResolvedValue({ data: previousDeviceBuffer });
    compareImagesMock.mockResolvedValue(100);

    const service = await import("../../src/iotdevice/iotdevice.service");

    const result = await service.uploadSingleImage({
      deviceName: "device-1",
      buffer: deviceBuffer,
      bufferOriginal: originalBuffer,
      id: "new-slideshow",
    });

    expect(getSignedFileUrlMock).toHaveBeenCalledWith({
      fileName: "ePaperDeviceImages/device-1.png",
    });
    expect(compareImagesMock).toHaveBeenCalledWith(
      previousDeviceBuffer,
      deviceBuffer
    );
    expect(result).toEqual(
      expect.objectContaining({
        skippedUpload: true,
        similarityPercentage: 100,
      })
    );
    expect(axiosMock.post).not.toHaveBeenCalled();
    expect(axiosMock.put).not.toHaveBeenCalled();
    expect(uploadParams.map(({ Key }) => Key)).toEqual([
      "ePaperImages/new-slideshow.png",
      "ePaperImages/new-slideshoworiginal.jpg",
      "ePaperImages/new-slideshoworiginal.png",
      "ePaperImages/new-slideshowthumbnail.jpg",
    ]);
    const preview = uploadParams.find(({ Key }) => Key.endsWith("original.jpg"));
    expect(await sharp(preview.Body).metadata()).toEqual(
      expect.objectContaining({ format: "jpeg", width: 8, height: 8 })
    );
    expect(saveDeviceUploadLogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deviceName: "device-1",
        paperId: "new-slideshow",
        status: "skipped",
        reason: "similarity-threshold-met",
        similarityPercentage: 100,
        decision: expect.objectContaining({ action: "skip" }),
        stages: expect.objectContaining({
          paperImages: expect.objectContaining({ status: "completed" }),
          iotPut: expect.objectContaining({ status: "not-run" }),
        }),
      })
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
        (params) => params.Key === "ePaperDeviceImages/device-1.png"
      )
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
      })
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
      })
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
      })
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
      })
    );
    expect(axiosMock.put).toHaveBeenCalledOnce();
  });
});
