import { beforeEach, describe, expect, it, vi } from "vitest";

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
const renderImageMock = vi.hoisted(() => vi.fn());
const ditherImageMock = vi.hoisted(() => vi.fn());

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
  },
}));

vi.mock("../../src/render/render.service.js", () => ({
  __esModule: true,
  default: {
    generateImageFromUrl: renderImageMock,
    ditherImage: ditherImageMock,
  },
}));

vi.mock("../../src/iotdevice/iotdevice.service", () => ({
  __esModule: true,
  default: {
    evaluateSimilarityBeforeUpload: evaluateSimilarityBeforeUploadMock,
    uploadSingleImage: uploadSingleImageMock,
  },
}));

vi.mock("../../src/iotdevice/iotdevice.service.js", () => ({
  __esModule: true,
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
  beforeEach(() => {
    fakePapers.clear();
    vi.clearAllMocks();

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
    expect(slideshow.save).toHaveBeenCalledOnce();
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
    expect(slideshow.save).toHaveBeenCalledOnce();
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
    expect(slideshow.save).toHaveBeenCalledOnce();
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
});
