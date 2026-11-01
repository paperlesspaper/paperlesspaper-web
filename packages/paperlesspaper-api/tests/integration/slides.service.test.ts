import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakePaper = {
  _id: string;
  id?: string;
  deviceId?: string;
  kind: string;
  meta?: Record<string, any>;
  organization?: string;
  save: ReturnType<typeof vi.fn>;
};

const fakePapers = vi.hoisted(() => new Map<string, FakePaper>());
const uploadSingleImageMock = vi.hoisted(() => vi.fn());
const evaluateSimilarityBeforeUploadMock = vi.hoisted(() => vi.fn());
const devicesGetByIdMock = vi.hoisted(() => vi.fn());
const deviceStatusMock = vi.hoisted(() => vi.fn());
const renderImageMock = vi.hoisted(() => vi.fn());
const ditherImageMock = vi.hoisted(() => vi.fn());
const prepareStoredImageMock = vi.hoisted(() => vi.fn());
const s3SendMock = vi.hoisted(() => vi.fn());
const paperUpdateOneMock = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return { ...actual, S3Client: class { send = s3SendMock; } };
});

const createPaper = (paper: Omit<FakePaper, "save">): FakePaper => {
  const doc: FakePaper = {
    ...paper,
    id: paper.id || paper._id,
    save: vi.fn(async function save(this: FakePaper) {
      fakePapers.set(this._id, this);
      return this;
    }),
  };
  fakePapers.set(doc._id, doc);
  return doc;
};

vi.mock("@internetderdinge/api", () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  devicesService: {
    getById: devicesGetByIdMock,
    populateDeviceStatus: deviceStatusMock,
  },
  getSignedFileUrl: vi.fn(async () => "https://example.invalid/current.png"),
  resolvePossiblyRelativeUrl: vi.fn((url: string) => url),
  SIMILARITY_THRESHOLD: 99.995,
  compareImages: vi.fn(async () => 0),
}));

vi.mock("@paperlesspaper/helpers", () => ({
  applications: [],
  applicationsByKind: vi.fn(() => ({
    settings: {},
    url: "https://apps.paperlesspaper.de/test",
  })),
}));

vi.mock("axios", () => ({
  __esModule: true,
  default: {
    get: vi.fn(async () => {
      throw new Error("No previous image in test");
    }),
  },
}));

vi.mock("../../src/render/render.service", () => ({
  __esModule: true,
  default: {
    generateImageFromUrl: renderImageMock,
    ditherImage: ditherImageMock,
    prepareStoredImageForDevice: prepareStoredImageMock,
  },
}));

vi.mock("../../src/render/render.service.js", () => ({
  __esModule: true,
  default: {
    generateImageFromUrl: renderImageMock,
    ditherImage: ditherImageMock,
    prepareStoredImageForDevice: prepareStoredImageMock,
  },
}));

vi.mock("../../src/iotdevice/iotdevice.service", () => ({
  __esModule: true,
  ORIGINAL_IMAGE_JPEG_KIND: "original.jpg",
  ORIGINAL_IMAGE_PNG_KIND: "original.png",
  THUMBNAIL_IMAGE_JPEG_KIND: "thumbnail.jpg",
  default: {
    evaluateSimilarityBeforeUpload: evaluateSimilarityBeforeUploadMock,
    uploadSingleImage: uploadSingleImageMock,
  },
}));

vi.mock("../../src/iotdevice/iotdevice.service.js", () => ({
  __esModule: true,
  ORIGINAL_IMAGE_JPEG_KIND: "original.jpg",
  ORIGINAL_IMAGE_PNG_KIND: "original.png",
  THUMBNAIL_IMAGE_JPEG_KIND: "thumbnail.jpg",
  default: {
    evaluateSimilarityBeforeUpload: evaluateSimilarityBeforeUploadMock,
    uploadSingleImage: uploadSingleImageMock,
  },
}));

vi.mock("../../src/papers/papers.model", () => ({
  __esModule: true,
  default: {
    paginate: vi.fn(async (filter: Record<string, any>) => ({
      results: Array.from(fakePapers.values()).filter((paper) => {
        if (filter.organization) {
          return paper.organization?.toString() === filter.organization;
        }
        if (filter.deviceId) {
          return paper.deviceId?.toString() === filter.deviceId;
        }
        return true;
      }),
    })),
    findById: vi.fn(async (id: string) => fakePapers.get(id) || null),
    updateOne: paperUpdateOneMock,
    find: vi.fn((filter: Record<string, any>) => {
      const selectedIds = new Set(
        filter?._id?.$in?.map((id: string) => id.toString()) || [],
      );
      const rows = Array.from(fakePapers.values()).filter((paper) =>
        selectedIds.has(paper._id),
      );
      return {
        select: vi.fn(() => ({
          lean: vi.fn(async () => rows),
        })),
      };
    }),
  },
}));

vi.mock("../../src/papers/papers.model.js", () => ({
  __esModule: true,
  default: {
    paginate: vi.fn(async (filter: Record<string, any>) => ({
      results: Array.from(fakePapers.values()).filter((paper) => {
        if (filter.organization) {
          return paper.organization?.toString() === filter.organization;
        }
        if (filter.deviceId) {
          return paper.deviceId?.toString() === filter.deviceId;
        }
        return true;
      }),
    })),
    findById: vi.fn(async (id: string) => fakePapers.get(id) || null),
    updateOne: paperUpdateOneMock,
    find: vi.fn((filter: Record<string, any>) => {
      const selectedIds = new Set(
        filter?._id?.$in?.map((id: string) => id.toString()) || [],
      );
      const rows = Array.from(fakePapers.values()).filter((paper) =>
        selectedIds.has(paper._id),
      );
      return {
        select: vi.fn(() => ({
          lean: vi.fn(async () => rows),
        })),
      };
    }),
  },
}));

describe("slides service", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  beforeEach(() => {
    fakePapers.clear();
    vi.clearAllMocks();
    paperUpdateOneMock.mockImplementation(async (filter, update) => {
      const paper = fakePapers.get(filter._id);
      if (!paper || paper.organization !== filter.organization || paper.kind !== filter.kind ||
          JSON.stringify(paper.meta?.selectedPapers) !== JSON.stringify(filter["meta.selectedPapers"]) ||
          (filter["meta.order"]?.$exists === false ? paper.meta?.order !== undefined : paper.meta?.order !== filter["meta.order"])) {
        return { matchedCount: 0 };
      }
      for (const [key, value] of Object.entries(update.$set || {})) {
        if (key.startsWith("meta.")) paper.meta = { ...paper.meta, [key.slice(5)]: value };
      }
      for (const key of Object.keys(update.$unset || {})) {
        if (key.startsWith("meta.")) delete paper.meta?.[key.slice(5)];
      }
      return { matchedCount: 1 };
    });

    devicesGetByIdMock.mockResolvedValue({
      _id: "device-object-id",
      organization: "org-1",
      paper: "slideshow-1",
      save: vi.fn(async () => undefined),
    });
    renderImageMock.mockResolvedValue({
      buffer: Buffer.from("rendered"),
      size: { width: 800, height: 480 },
      diagnostics: {
        renderer: "puppeteer",
        durationMs: 1250,
        readiness: { outcome: "website-has-loaded", waitDurationMs: 220 },
      },
    });
    ditherImageMock.mockResolvedValue({
      buffer: Buffer.from("dithered"),
      size: { width: 800, height: 480 },
    });
    evaluateSimilarityBeforeUploadMock.mockResolvedValue({
      skipUpload: false,
      similarityPercentage: 0,
    });
    uploadSingleImageMock.mockResolvedValue({
      key: "mock-key",
      similarityPercentage: 0,
      skippedUpload: false,
    });
  });

  it.each([undefined, { sleepTime: 28800, paperCronjobSync: { leaseId: "keep" } }])(
    "saves only the frame-pending path on a real Mongoose document with meta %j",
    async (meta) => {
      const mongoose = (await import("mongoose")).default;
      const Model = mongoose.models.FramePendingRegression || mongoose.model(
        "FramePendingRegression", new mongoose.Schema({ paper: String, meta: mongoose.Schema.Types.Mixed }),
      );
      const device = Model.hydrate({ _id: new mongoose.Types.ObjectId(), paper: "slideshow-1", ...(meta ? { meta } : {}) });
      vi.spyOn(device, "save").mockResolvedValue(device);
      deviceStatusMock.mockResolvedValue({ nextDeviceSync: new Date(Date.now() + 600_000).toISOString() });
      const service = (await import("../../src/papers/papers.service")).default;
      await service.markCurrentFrameImageSyncPending({ device, paperId: "slideshow-1" });
      const changes = device.getChanges();
      expect(Object.keys(changes.$set || {})).toEqual(["meta.currentFrameImageSyncPending"]);
      expect(changes.$set?.["meta.currentFrameImageSyncPending"]).toMatchObject({ paperId: "slideshow-1" });
      expect(changes.$unset).toBeUndefined();
      if (meta) expect(device.meta.paperCronjobSync.leaseId).toBe("keep");
    },
  );

  it("rejects a source transferred to another organization after the slideshow listing", async () => {
    const slideshow = createPaper({ _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { selectedPapers: { "source-1": true }, currentSlide: 0 } });
    createPaper({ _id: "source-1", kind: "image", organization: "org-1", meta: {} });
    const Paper = (await import("../../src/papers/papers.model")).default;
    vi.mocked(Paper.findById).mockResolvedValueOnce({ _id: "source-1", kind: "image", organization: "org-2", meta: {} } as any);
    s3SendMock.mockResolvedValue({ Body: Readable.from([Buffer.from("stored image")]) });
    prepareStoredImageMock.mockResolvedValue({ buffer: Buffer.from("image"), bufferOriginal: Buffer.from("original") });
    const service = (await import("../../src/papers/papers.service")).default;
    await expect(service.updateNextSlide(slideshow, { deviceId: "FRAME-A", kind: "epd7", organization: "org-1" })).rejects.toThrow();
    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it.each(["image", "plugin"])("stops a %s source moved to another organization during rendering", async (kind) => {
    const slideshow = createPaper({ _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { selectedPapers: { "source-1": true }, currentSlide: 0 } });
    const source = createPaper({ _id: "source-1", kind, organization: "org-1", deviceId: "source-device",
      meta: { pluginRenderPage: "https://plugins.example/render" } });
    const rendered = { buffer: Buffer.from("image"), bufferOriginal: Buffer.from("original"), size: { width: 800, height: 480 } };
    s3SendMock.mockImplementation(async () => ({ Body: Readable.from([Buffer.from("stored image")]) }));
    const moveDuringRender = async () => { source.organization = "org-2"; return rendered; };
    if (kind === "image") prepareStoredImageMock.mockImplementationOnce(moveDuringRender);
    else renderImageMock.mockImplementationOnce(moveDuringRender);
    const service = (await import("../../src/papers/papers.service")).default;
    await expect(service.updateNextSlide(slideshow, { deviceId: "FRAME-A", kind: "epd7", organization: "org-1" }, "cronjob-slideshow", vi.fn().mockResolvedValue(undefined))).rejects.toThrow("assignment changed");
    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(slideshow.save).not.toHaveBeenCalled();
  });

  it("uses the target frame, not the source image's original frame, for shared same-organization images", async () => {
    const slideshow = createPaper({ _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { selectedPapers: { "source-1": true } } });
    createPaper({ _id: "source-1", kind: "image", organization: "org-1", deviceId: "ORIGINAL-FRAME", meta: {} });
    s3SendMock.mockImplementation(async () => ({ Body: Readable.from([Buffer.from("stored image")]) }));
    prepareStoredImageMock.mockResolvedValue({ buffer: Buffer.from("image"), bufferOriginal: Buffer.from("original") });
    const service = (await import("../../src/papers/papers.service")).default;
    await service.updateNextSlide(slideshow, { _id: "target-db-id", deviceId: "TARGET-FRAME", kind: "epd7", organization: "org-1" }, "cronjob-slideshow", vi.fn().mockResolvedValue(undefined));
    expect(uploadSingleImageMock).toHaveBeenCalledOnce();
    expect(uploadSingleImageMock.mock.calls[0][0]).toMatchObject({ deviceName: "TARGET-FRAME", deviceId: "target-db-id", id: "slideshow-1", beforeUpload: expect.any(Function) });
  });

  it("does not reactivate a shared slideshow on its original frame when another frame advances it", async () => {
    const originalFrame = { _id: "original-frame-db", deviceId: "ORIGINAL-FRAME", organization: "org-1", paper: "user-selected-other-paper", meta: {}, save: vi.fn() };
    devicesGetByIdMock.mockResolvedValue(originalFrame);
    const slideshow = createPaper({ _id: "slideshow-1", kind: "slides", organization: "org-1", deviceId: originalFrame._id,
      meta: { selectedPapers: { "source-1": true } } });
    createPaper({ _id: "source-1", kind: "image", organization: "org-1", meta: {} });
    s3SendMock.mockImplementation(async () => ({ Body: Readable.from([Buffer.from("stored image")]) }));
    prepareStoredImageMock.mockResolvedValue({ buffer: Buffer.from("image"), bufferOriginal: Buffer.from("original") });
    const service = (await import("../../src/papers/papers.service")).default;
    await service.updateNextSlide(slideshow, { deviceId: "TARGET-FRAME", kind: "epd7", organization: "org-1" });
    expect(uploadSingleImageMock.mock.calls[0][0].deviceName).toBe("TARGET-FRAME");
    expect(originalFrame.paper).toBe("user-selected-other-paper");
    expect(originalFrame.save).not.toHaveBeenCalled();
  });

  it("stops the whole job instead of trying other slides after target validation fails", async () => {
    const slideshow = createPaper({ _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { selectedPapers: { "source-1": true, "source-2": true, "source-3": true, "source-4": true } } });
    for (const id of Object.keys(slideshow.meta!.selectedPapers)) createPaper({ _id: id, kind: "image", organization: "org-1", meta: {} });
    const guard = vi.fn().mockRejectedValue(new Error("target revoked"));
    const service = (await import("../../src/papers/papers.service")).default;
    await expect(service.updateNextSlide(slideshow, { deviceId: "TARGET-FRAME", kind: "epd7", organization: "org-1" }, "cronjob-slideshow", guard)).rejects.toThrow("target revoked");
    expect(guard).toHaveBeenCalledOnce();
    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(paperUpdateOneMock).not.toHaveBeenCalled();
  });

  it.skipIf(!process.env.CRONJOB_TEST_MONGODB_URL).each(["unchanged", "organization", "selection", "unrelated-setting"])(
    "atomically saves only progress in real MongoDB when %s changes during upload", async (change) => {
      const mongoose = (await import("mongoose")).default;
      const connection = await mongoose.createConnection(process.env.CRONJOB_TEST_MONGODB_URL!).asPromise();
      const Stored = connection.model("SlideshowSecurityProgress", new mongoose.Schema({
        _id: String, organization: String, kind: String, meta: mongoose.Schema.Types.Mixed,
      }), "slideshow_security_progress_test");
      try {
        await Stored.deleteMany({});
        const slideshow = createPaper({ _id: "slideshow-1", kind: "slides", organization: "org-1",
          meta: { currentSlide: 0, lastSelectedPaperId: "old", selectedPapers: { "source-1": true } } });
        await Stored.create({ _id: slideshow._id, kind: slideshow.kind, organization: slideshow.organization, meta: slideshow.meta });
        createPaper({ _id: "source-1", kind: "image", organization: "org-1", meta: {} });
        s3SendMock.mockImplementation(async () => ({ Body: Readable.from([Buffer.from("stored image")]) }));
        prepareStoredImageMock.mockResolvedValue({ buffer: Buffer.from("image"), bufferOriginal: Buffer.from("original") });
        paperUpdateOneMock.mockImplementation((filter, update) => Stored.updateOne(filter, update));
        uploadSingleImageMock.mockImplementationOnce(async () => {
          const update = change === "organization" ? { organization: "org-2" }
            : change === "selection" ? { "meta.selectedPapers": { "new-source": true } }
            : change === "unrelated-setting" ? { "meta.title": "new user setting" } : {};
          if (Object.keys(update).length) await Stored.updateOne({ _id: slideshow._id }, { $set: update });
          return { skippedUpload: false };
        });
        const service = (await import("../../src/papers/papers.service")).default;
        const run = service.updateNextSlide(slideshow, { deviceId: "TARGET-FRAME", kind: "epd7", organization: "org-1" });
        if (change === "organization" || change === "selection") await expect(run).rejects.toThrow("progress not saved");
        else await run;
        const persisted = await Stored.findById(slideshow._id).lean();
        expect(persisted?.meta.lastSelectedPaperId).toBe(change === "organization" || change === "selection" ? "old" : "source-1");
        if (change === "unrelated-setting") expect(persisted?.meta.title).toBe("new user setting");
        if (change === "organization") expect(persisted?.organization).toBe("org-2");
        if (change === "selection") expect(persisted?.meta.selectedPapers).toEqual({ "new-source": true });
        expect(uploadSingleImageMock).toHaveBeenCalledOnce();
      } finally {
        await Stored.deleteMany({});
        await connection.close();
      }
    },
  );

  it.each(["default", "random"])("does not advance a %s slideshow when every attempted upload fails", async (order) => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { order, currentSlide: 0, selectedPapers: { "slide-1": true, "slide-2": true } },
    });
    for (const id of ["slide-1", "slide-2"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", deviceId: "device-object-id", meta: {},
    });
    uploadSingleImageMock.mockRejectedValue(new Error("Temporary upload failure"));
    const service = (await import("../../src/papers/papers.service")).default;
    const device = { deviceId: "DEVICE-1", kind: "epd7" };
    await expect(service.updateNextSlide(slideshow, device)).rejects.toThrow("Temporary upload failure");
    expect(slideshow.meta?.currentSlide).toBe(0);
    expect(slideshow.save).not.toHaveBeenCalled();

    uploadSingleImageMock.mockResolvedValue({ key: "mock-key", skippedUpload: false });
    await service.updateNextSlide(slideshow, device);
    expect(slideshow.meta?.currentSlide).toBe(1);
    expect(paperUpdateOneMock).toHaveBeenCalledOnce();
    expect(slideshow.save).not.toHaveBeenCalled();
    const sources = uploadSingleImageMock.mock.calls.map(([args]) => args.triggerMetadata.sourcePaperId);
    expect(sources).toEqual(order === "random" ? ["slide-2", "slide-2"] : ["slide-1", "slide-2", "slide-1"]);
  });

  it.each([null, { uploadFailed: true, skippedUpload: false }])("keeps the slide position when the image uploader returns failure %j", async (failure) => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { order: "default", currentSlide: 0, selectedPapers: { "image-1": true, "image-2": true } },
    });
    for (const id of ["image-1", "image-2"]) createPaper({
      _id: id, kind: "image", organization: "org-1", meta: {},
    });
    s3SendMock.mockImplementation(async () => ({ Body: Readable.from([Buffer.from("stored image")]) }));
    prepareStoredImageMock.mockResolvedValue({ buffer: Buffer.from("image"), bufferOriginal: Buffer.from("original") });
    uploadSingleImageMock.mockResolvedValue(failure);
    const service = (await import("../../src/papers/papers.service")).default;
    await expect(service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" })).rejects.toThrow("Could not upload slide image");
    expect(slideshow.meta?.currentSlide).toBe(0);
    expect(slideshow.save).not.toHaveBeenCalled();
  });

  it("skips a failed plugin, preserves order, and retries it on the next rotation", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { order: "default", currentSlide: 0, selectedPapers: {
        "broken": true, "next": true, "last": true,
      } },
    });
    for (const id of ["broken", "next", "last"]) createPaper({
      _id: id, kind: "plugin", organization: "org-1", meta: {
        pluginRenderPage: "https://plugins.example/render",
      },
    });
    // The renderer returns no buffer after rejecting an HTTP 400 response.
    renderImageMock.mockResolvedValueOnce({
      buffer: null, size: { width: 800, height: 480 },
      diagnostics: { error: { message: "Render page returned HTTP 400" } },
    });
    const service = (await import("../../src/papers/papers.service")).default;
    const device = { deviceId: "DEVICE-1", kind: "epd7" };

    const result = await service.updateNextSlide(slideshow, device);
    expect(result?.skippedPaperIds).toEqual(["broken"]);
    expect(slideshow.meta?.lastSelectedPaperId).toBe("next");
    expect(slideshow.meta?.currentSlide).toBe(2);
    expect(paperUpdateOneMock).toHaveBeenCalledOnce();
    expect(slideshow.save).not.toHaveBeenCalled();
    expect(uploadSingleImageMock).toHaveBeenCalledOnce();

    await service.updateNextSlide(slideshow, device);
    await service.updateNextSlide(slideshow, device);
    expect(uploadSingleImageMock.mock.calls.map(([args]) => args.triggerMetadata.sourcePaperId))
      .toEqual(["next", "last", "broken"]);
    expect(slideshow.meta?.currentSlide).toBe(1);
  });

  it("wraps past several failed entries and tries each at most once", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 2, lastSelectedPaperId: "slide-2", selectedPapers: {
        "slide-1": true, "slide-2": true, "slide-3": true,
      } },
    });
    for (const id of ["slide-1", "slide-2", "slide-3"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    renderImageMock.mockRejectedValueOnce(new Error("failed slide-3"))
      .mockRejectedValueOnce(new Error("failed slide-1"));
    const service = (await import("../../src/papers/papers.service")).default;
    const result = await service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" });
    expect(renderImageMock.mock.calls.map(([args]) => args.paper._id))
      .toEqual(["slide-3", "slide-1", "slide-2"]);
    expect(result?.skippedPaperIds).toEqual(["slide-3", "slide-1"]);
    expect(slideshow.meta?.lastSelectedPaperId).toBe("slide-2");
    expect(slideshow.meta?.currentSlide).toBe(2);
    expect(uploadSingleImageMock).toHaveBeenCalledOnce();
  });

  it("stops after one rotation when all renders fail and keeps the saved position", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 1, lastSelectedPaperId: "slide-1", selectedPapers: {
        "slide-1": true, "slide-2": true, "slide-3": true,
      } },
    });
    for (const id of ["slide-1", "slide-2", "slide-3"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    renderImageMock.mockResolvedValue({ buffer: null, size: { width: 800, height: 480 } });
    const service = (await import("../../src/papers/papers.service")).default;
    await expect(service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" }))
      .rejects.toThrow("Could not render paper image");
    expect(renderImageMock.mock.calls.map(([args]) => args.paper._id))
      .toEqual(["slide-2", "slide-3", "slide-1"]);
    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(slideshow.save).not.toHaveBeenCalled();
    expect(slideshow.meta?.currentSlide).toBe(1);
    expect(slideshow.meta?.lastSelectedPaperId).toBe("slide-1");
  });

  it("does not upload another slide when saving the successful position fails", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 0, selectedPapers: { "slide-1": true, "slide-2": true } },
    });
    for (const id of ["slide-1", "slide-2"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    paperUpdateOneMock.mockRejectedValueOnce(new Error("database unavailable"));
    const service = (await import("../../src/papers/papers.service")).default;
    await expect(service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" }))
      .rejects.toThrow("database unavailable");
    expect(uploadSingleImageMock).toHaveBeenCalledOnce();
    expect(renderImageMock).toHaveBeenCalledOnce();
  });

  it("limits a long failing slideshow to three attempts and resumes at the next entry", async () => {
    vi.useFakeTimers();
    const ids = Array.from({ length: 41 }, (_, i) => `slide-${i}`);
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 0, lastSelectedPaperId: "slide-40",
        selectedPapers: Object.fromEntries(ids.map(id => [id, true])) },
    });
    for (const id of ids) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    renderImageMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 15_000));
      return { buffer: null, size: { width: 800, height: 480 } };
    });
    const service = (await import("../../src/papers/papers.service")).default;
    const device = { deviceId: "DEVICE-1", kind: "epd7" };
    const assertion = expect(service.updateNextSlide(slideshow, device))
      .rejects.toThrow("Could not render paper image");
    await vi.advanceTimersByTimeAsync(45_000);
    await assertion;
    expect(renderImageMock.mock.calls.map(([args]) => args.paper._id)).toEqual(ids.slice(0, 3));
    expect(paperUpdateOneMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ _id: "slideshow-1", organization: "org-1", kind: "slides" }), { $set: { "meta.slideshowRetryPaperId": "slide-3" } },
    );
    expect(slideshow.save).not.toHaveBeenCalled();
    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(slideshow.meta?.currentSlide).toBe(0);
    expect(slideshow.meta?.lastSelectedPaperId).toBe("slide-40");

    renderImageMock.mockResolvedValue({ buffer: Buffer.from("recovered"), size: { width: 800, height: 480 } });
    await service.updateNextSlide(slideshow, device);
    expect(uploadSingleImageMock.mock.calls[0][0].triggerMetadata.sourcePaperId).toBe("slide-3");
    expect(slideshow.meta?.currentSlide).toBe(4);
    expect(slideshow.meta?.slideshowRetryPaperId).toBeUndefined();
  });

  it("wraps the retry cursor when a second budget is exhausted", async () => {
    const ids = ["slide-0", "slide-1", "slide-2", "slide-3", "slide-4"];
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 0, selectedPapers: Object.fromEntries(ids.map(id => [id, true])) },
    });
    for (const id of ids) createPaper({ _id: id, kind: "calendar", organization: "org-1", meta: {} });
    renderImageMock.mockResolvedValue({ buffer: null, size: { width: 800, height: 480 } });
    const service = (await import("../../src/papers/papers.service")).default;
    for (let i = 0; i < 2; i++) {
      await expect(service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" })).rejects.toThrow();
    }
    expect(renderImageMock.mock.calls.map(([args]) => args.paper._id))
      .toEqual(["slide-0", "slide-1", "slide-2", "slide-3", "slide-4", "slide-0"]);
    expect(slideshow.meta?.slideshowRetryPaperId).toBe("slide-1");
    expect(slideshow.save).not.toHaveBeenCalled();
  });

  it("ignores a retry cursor whose entry is no longer selected", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 1, lastSelectedPaperId: "slide-1", slideshowRetryPaperId: "removed",
        selectedPapers: { "slide-1": true, "slide-2": true } },
    });
    for (const id of ["slide-1", "slide-2"]) createPaper({ _id: id, kind: "calendar", organization: "org-1", meta: {} });
    const service = (await import("../../src/papers/papers.service")).default;
    await service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" });
    expect(uploadSingleImageMock.mock.calls[0][0].triggerMetadata.sourcePaperId).toBe("slide-2");
    expect(slideshow.meta?.slideshowRetryPaperId).toBeUndefined();
  });

  it("destroys a stalled S3 response stream and preserves the slide for retry", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { order: "default", currentSlide: 0, selectedPapers: { "image-1": true } },
    });
    createPaper({ _id: "image-1", kind: "image", organization: "org-1", meta: {} });
    const body = new Readable({ read() {} });
    s3SendMock.mockResolvedValue({ Body: body });
    const service = (await import("../../src/papers/papers.service")).default;
    vi.useFakeTimers();
    const update = service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" });
    const assertion = expect(update).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(body.destroyed).toBe(true);
    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(slideshow.meta?.currentSlide).toBe(0);
  });

  it.each(["png", "jpg"])("prepares stored slides from the lossless original or legacy %s fallback", async (originalFormat) => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", deviceId: "device-object-id",
      organization: "org-1",
      meta: { order: "default", currentSlide: 0, selectedPapers: { "image-1": true } },
    });
    createPaper({
      _id: "image-1", kind: "image", deviceId: "device-object-id",
      organization: "org-1", meta: { orientation: "portrait", frameKind: "epd7" },
    });
    const original = Buffer.from("stored original");
    const processed = Buffer.from("stored device image");
    s3SendMock.mockImplementation(async (command) => {
      const key = command.input.Key;
      if (originalFormat === "jpg" && key.endsWith("original.png")) {
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      }
      return { Body: Readable.from([
        key.endsWith(`original.${originalFormat}`) ? original : processed,
      ]) };
    });
    prepareStoredImageMock.mockResolvedValue({
      buffer: Buffer.from("device-sized"), bufferOriginal: Buffer.from("resized original"),
    });
    const papersService = (await import("../../src/papers/papers.service")).default;
    await papersService.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" });
    expect(prepareStoredImageMock).toHaveBeenCalledWith({
      buffer: processed, bufferOriginal: original, kind: "epd7", sourceFrameKind: "epd7", orientation: "portrait",
    });
    expect(uploadSingleImageMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "slideshow-1", deviceName: "DEVICE-1",
      buffer: Buffer.from("device-sized"), bufferOriginal: Buffer.from("resized original"),
    }));
  });

  it.each(["missing", "denied"])("handles a %s processed image and continues to a usable slide", async (failure) => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { currentSlide: 0, selectedPapers: { "image-1": true, "image-2": true } },
    });
    for (const id of ["image-1", "image-2"]) createPaper({
      _id: id, kind: "image", organization: "org-1", meta: {},
    });
    s3SendMock.mockImplementation(async (command) => {
      if (command.input.Key === "ePaperImages/image-1.png") {
        throw Object.assign(new Error(failure), { name: failure === "missing" ? "NoSuchKey" : "AccessDenied" });
      }
      return { Body: Readable.from([Buffer.from("original source")]) };
    });
    prepareStoredImageMock.mockResolvedValue({ buffer: Buffer.from("rebuilt"), bufferOriginal: Buffer.from("original source") });
    const service = (await import("../../src/papers/papers.service")).default;
    const update = service.updateNextSlide(slideshow, { deviceId: "DEVICE-1", kind: "epd7" });
    if (failure === "denied") {
      await update;
      expect(prepareStoredImageMock).toHaveBeenCalledOnce();
      expect(uploadSingleImageMock).toHaveBeenCalledOnce();
      expect(uploadSingleImageMock.mock.calls[0][0].triggerMetadata.sourcePaperId).toBe("image-2");
      expect(slideshow.meta?.currentSlide).toBe(0);
      expect(slideshow.meta?.lastSelectedPaperId).toBe("image-2");
    } else {
      await update;
      expect(prepareStoredImageMock).toHaveBeenCalledWith(expect.objectContaining({ buffer: null, bufferOriginal: Buffer.from("original source") }));
      expect(uploadSingleImageMock).toHaveBeenCalledWith(expect.objectContaining({ buffer: Buffer.from("rebuilt") }));
      expect(slideshow.meta?.currentSlide).toBe(1);
    }
  });

  it("prepares the playlist entry active at the planned device wakeup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    for (const id of ["morning", "meeting"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    const playlist = createPaper({
      _id: "playlist-1", kind: "playlist", organization: "org-1", meta: { playlistEntries: [
        { paperId: "morning", startsAt: "2026-09-09T09:00:00Z", durationMinutes: 60 },
        { paperId: "meeting", startsAt: "2026-09-09T10:03:00Z", durationMinutes: 60 },
      ] },
    });
    const service = (await import("../../src/papers/papers.service")).default;
    const result = await service.updatePlaylist(playlist, { deviceId: "DEVICE-1", kind: "epd7" }, "cronjob-playlist", new Date("2026-09-09T10:05:00Z"));
    expect(result.selectedPaperId).toBe("meeting");
    expect(uploadSingleImageMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["2026-09-09T10:29:59Z", "brief"],
    ["2026-09-09T10:30:00Z", "brief"],
    ["2026-09-09T10:31:00Z", "brief"],
    ["2026-09-09T18:00:00Z", "brief"],
    ["2026-09-09T19:00:00Z", "background"],
  ])("keeps scheduled content active until its replacement at %s", async (now, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    for (const id of ["brief", "background"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    const playlist = createPaper({
      _id: "playlist-1", kind: "playlist", organization: "org-1", meta: { playlistEntries: [
        { paperId: "background", startsAt: "2026-09-09T09:00:00Z", durationMinutes: 180 },
        { paperId: "brief", startsAt: "2026-09-09T10:00:00Z", durationMinutes: 30 },
        { paperId: "background", startsAt: "2026-09-09T19:00:00Z", durationMinutes: 60 },
      ] },
    });
    const service = (await import("../../src/papers/papers.service")).default;
    const result = await service.updatePlaylist(playlist, { deviceId: "DEVICE-1", kind: "epd7" });
    expect(result.selectedPaperId).toBe(expected);
    expect(renderImageMock).toHaveBeenCalledWith(expect.objectContaining({paper: expect.objectContaining({_id: expected})}));
  });

  it("advances a chronological slideshow and uploads the selected slide", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1",
      deviceId: "device-object-id",
      kind: "slides",
      organization: "org-1",
      meta: {
        order: "default",
        currentSlide: 0,
        selectedPapers: {
          "slide-1": true,
          "slide-2": true,
          "slide-3": true,
        },
      },
    });
    createPaper({
      _id: "slide-1",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });
    createPaper({
      _id: "slide-2",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });
    createPaper({
      _id: "slide-3",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });

    const papersService = (await import("../../src/papers/papers.service"))
      .default;

    const result = await papersService.updateNextSlide(slideshow, {
      deviceId: "DEVICE-1",
      kind: "epd7",
    });

    expect(slideshow.meta?.currentSlide).toBe(1);
    expect(paperUpdateOneMock).toHaveBeenCalledOnce();
    expect(slideshow.save).not.toHaveBeenCalled();
    expect(renderImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paper: expect.objectContaining({ _id: "slide-1" }),
        kind: "epd7",
      }),
    );
    expect(uploadSingleImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slideshow-1",
        deviceName: "DEVICE-1",
        buffer: Buffer.from("dithered"),
        bufferOriginal: Buffer.from("rendered"),
        trigger: "slideshow",
        triggerMetadata: expect.objectContaining({
          sourcePaperId: "slide-1",
          parentPaperId: "slideshow-1",
        }),
        render: expect.objectContaining({
          renderer: "puppeteer",
          durationMs: 1250,
          readiness: expect.objectContaining({
            outcome: "website-has-loaded",
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        selectedSequential: 1,
      }),
    );
  });

  it("normalizes an out-of-range currentSlide before selecting a slide", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1",
      deviceId: "device-object-id",
      kind: "slides",
      organization: "org-1",
      meta: {
        order: "default",
        currentSlide: 5,
        selectedPapers: {
          "slide-1": true,
          "slide-2": true,
        },
      },
    });
    createPaper({
      _id: "slide-1",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });
    createPaper({
      _id: "slide-2",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });

    const papersService = (await import("../../src/papers/papers.service"))
      .default;

    const result = await papersService.updateNextSlide(slideshow, {
      deviceId: "DEVICE-1",
      kind: "epd7",
    });

    expect(slideshow.meta?.currentSlide).toBe(1);
    expect(paperUpdateOneMock).toHaveBeenCalledOnce();
    expect(slideshow.save).not.toHaveBeenCalled();
    expect(renderImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paper: expect.objectContaining({ _id: "slide-1" }),
        kind: "epd7",
      }),
    );
    expect(uploadSingleImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slideshow-1",
        deviceName: "DEVICE-1",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        selectedSequential: 1,
      }),
    );
  });

  it("keeps sequential order when an earlier photo is removed", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { order: "default", currentSlide: 1, selectedPapers: { "slide-1": true, "slide-2": true, "slide-3": true, "slide-4": true } },
    });
    for (const id of ["slide-1", "slide-2", "slide-3", "slide-4"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    const service = (await import("../../src/papers/papers.service")).default;
    const device = { deviceId: "DEVICE-1", kind: "epd7" };
    await service.updateNextSlide(slideshow, device);
    fakePapers.delete("slide-1");
    await service.updateNextSlide(slideshow, device);
    await service.updateNextSlide(slideshow, device);
    await service.updateNextSlide(slideshow, device);
    expect(uploadSingleImageMock.mock.calls.map(([args]) => args.triggerMetadata.sourcePaperId)).toEqual(["slide-2", "slide-3", "slide-4", "slide-2"]);
  });

  it.each(["deselected", "deleted"])("does not repeat a random slide after an earlier slide is %s", async (change) => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const slideshow = createPaper({
      _id: "slideshow-1", kind: "slides", organization: "org-1",
      meta: { order: "random", currentSlide: 0, selectedPapers: { "slide-1": true, "slide-2": true, "slide-3": true } },
    });
    for (const id of ["slide-1", "slide-2", "slide-3"]) createPaper({
      _id: id, kind: "calendar", organization: "org-1", meta: {},
    });
    const service = (await import("../../src/papers/papers.service")).default;
    const device = { deviceId: "DEVICE-1", kind: "epd7" };
    await service.updateNextSlide(slideshow, device);
    if (change === "deleted") fakePapers.delete("slide-1");
    else slideshow.meta!.selectedPapers["slide-1"] = false;
    await service.updateNextSlide(slideshow, device);
    expect(uploadSingleImageMock.mock.calls.map(([args]) => args.triggerMetadata.sourcePaperId)).toEqual(["slide-2", "slide-3"]);
    expect(slideshow.meta?.lastSelectedPaperId).toBe("slide-3");
  });

  it("does not randomly select the same slide twice when alternatives exist", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const slideshow = createPaper({
      _id: "slideshow-1",
      deviceId: "device-object-id",
      kind: "slides",
      organization: "org-1",
      meta: {
        order: "random",
        currentSlide: 0,
        selectedPapers: {
          "slide-1": true,
          "slide-2": true,
          "slide-3": true,
        },
      },
    });
    createPaper({
      _id: "slide-1",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });
    createPaper({
      _id: "slide-2",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });
    createPaper({
      _id: "slide-3",
      deviceId: "device-object-id",
      kind: "calendar",
      organization: "org-1",
      meta: { orientation: "portrait" },
    });

    const papersService = (await import("../../src/papers/papers.service"))
      .default;

    const result = await papersService.updateNextSlide(slideshow, {
      deviceId: "DEVICE-1",
      kind: "epd7",
    });

    expect(slideshow.meta?.currentSlide).toBe(1);
    expect(paperUpdateOneMock).toHaveBeenCalledOnce();
    expect(slideshow.save).not.toHaveBeenCalled();
    expect(renderImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paper: expect.objectContaining({ _id: "slide-2" }),
        kind: "epd7",
      }),
    );
    expect(uploadSingleImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slideshow-1",
        deviceName: "DEVICE-1",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        selectedRandom: expect.objectContaining({ key: "slide-2" }),
      }),
    );

    randomSpy.mockRestore();
  });

  it("returns a skip message and does not upload when no selected papers are configured", async () => {
    const slideshow = createPaper({
      _id: "slideshow-1",
      deviceId: "device-object-id",
      kind: "slides",
      organization: "org-1",
      meta: {},
    });

    const papersService = (await import("../../src/papers/papers.service"))
      .default;

    const result = await papersService.updateNextSlide(slideshow, {
      deviceId: "DEVICE-1",
      kind: "epd7",
    });

    expect(uploadSingleImageMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      message:
        "Paper is missing selectedPapers in meta, cannot update next slide",
    });
  });

  it("passes OpenIntegration settings and timezone to the renderer", async () => {
    const pluginSettings = {
      headline: "Configured headline",
      accent: "green",
      showTimestamp: true,
    };
    createPaper({
      _id: "plugin-1",
      deviceId: "device-object-id",
      kind: "plugin",
      organization: "org-1",
      meta: {
        orientation: "portrait",
        pluginManifest: { timezone: "Europe/Berlin" },
        pluginRenderPage: "https://plugins.example/render?existing=1#screen",
        pluginSettings,
      },
    });

    const papersService = (await import("../../src/papers/papers.service"))
      .default;

    await papersService.uploadSingleImageFromWebsite({
      paperId: "plugin-1",
      device: {
        deviceId: "DEVICE-1",
        kind: "epd7",
        paper: "other-paper",
      },
    });

    const renderOptions = renderImageMock.mock.calls.at(-1)?.[0];
    const renderUrl = new URL(renderOptions.url);

    expect(renderUrl.origin + renderUrl.pathname).toBe(
      "https://plugins.example/render",
    );
    expect(renderUrl.searchParams.get("existing")).toBe("1");
    expect(renderUrl.searchParams.get("headline")).toBe("Configured headline");
    expect(renderUrl.searchParams.get("accent")).toBe("green");
    expect(renderUrl.searchParams.get("showTimestamp")).toBe("true");
    expect(renderUrl.hash).toBe("#screen");
    expect(renderOptions.data.settings).toEqual(pluginSettings);
    expect(renderOptions.timezone).toBe("Europe/Berlin");
  });

  it("passes a Website integration timezone to the renderer", async () => {
    createPaper({
      _id: "website-1",
      deviceId: "device-object-id",
      kind: "website",
      organization: "org-1",
      meta: {
        orientation: "portrait",
        timezone: "America/New_York",
        url: "https://example.com/dashboard",
      },
    });

    const papersService = (await import("../../src/papers/papers.service"))
      .default;

    await papersService.uploadSingleImageFromWebsite({
      paperId: "website-1",
      device: {
        deviceId: "DEVICE-1",
        kind: "epd7",
        paper: "other-paper",
      },
    });

    const renderOptions = renderImageMock.mock.calls.at(-1)?.[0];

    expect(renderOptions.url).toBe("https://example.com/dashboard");
    expect(renderOptions.timezone).toBe("America/New_York");
  });
});
