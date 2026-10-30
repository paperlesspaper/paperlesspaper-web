import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  getBrowserLaunchOptions,
  getRenderInitPayload,
  emulatePageTimezone,
} from "../../src/render/render.browser";
import renderService from "../../src/render/render.service";
import { parseEpdOptimizeMetaContent } from "../../src/render/epdOptimizeMeta";

const originalChromeBin = process.env.CHROME_BIN;

const restoreChromeBin = () => {
  if (originalChromeBin === undefined) {
    delete process.env.CHROME_BIN;
    return;
  }

  process.env.CHROME_BIN = originalChromeBin;
};

describe("render.service browser launch options", () => {
  afterEach(() => {
    restoreChromeBin();
  });

  it("uses the configured headless shell executable", () => {
    process.env.CHROME_BIN = "/usr/bin/chromium-headless-shell";

    const options = getBrowserLaunchOptions();

    expect(options).toMatchObject({
      executablePath: "/usr/bin/chromium-headless-shell",
      headless: "shell",
    });
    expect(options.args).not.toContain("--no-sandbox");
    expect(options.args).not.toContain("--disable-setuid-sandbox");
    expect(options.args).toContain("--proxy-bypass-list=<-loopback>");
    expect(options.args).toContain("--disable-quic");
  });
});

describe("render.service INIT payload", () => {
  it("sends the OpenIntegration render payload for plugin papers", () => {
    const payload = {
      settings: { headline: "Configured headline" },
      nativeSettings: { orientation: "portrait" },
    };
    const paper = {
      kind: "plugin",
      meta: {
        pluginSettings: { headline: "Configured headline" },
      },
    };

    expect(getRenderInitPayload({ data: payload, paper })).toBe(payload);
  });

  it("keeps the legacy paper document INIT payload for non-plugin papers", () => {
    const payload = { calendarData: [] };
    const paper = {
      kind: "google-calendar",
      meta: { dayRange: 7 },
    };

    expect(getRenderInitPayload({ data: payload, paper })).toBe(paper);
  });
});

describe("render.service timezone", () => {
  it("emulates a configured timezone", async () => {
    const page = { emulateTimezone: vi.fn() };

    await emulatePageTimezone(page, "Europe/Berlin");

    expect(page.emulateTimezone).toHaveBeenCalledWith("Europe/Berlin");
  });

  it("keeps the browser timezone when none is configured", async () => {
    const page = { emulateTimezone: vi.fn() };

    await emulatePageTimezone(page);

    expect(page.emulateTimezone).not.toHaveBeenCalled();
  });
});

describe("render.service EPD optimization", () => {
  it("parses the palette and intent from the integration meta tag", () => {
    expect(
      parseEpdOptimizeMetaContent(
        JSON.stringify({
          intent: "readable",
          palette: "spectra6OriginalPalette",
        }),
      ),
    ).toEqual({
      intent: "readable",
      paletteName: "spectra6OriginalPalette",
    });
  });

  it("preserves exact green with the Spectra 6 Original palette", async () => {
    const source = createCanvas(8, 8);
    const sourceContext = source.getContext("2d");
    sourceContext.fillStyle = "#00ff00";
    sourceContext.fillRect(0, 0, source.width, source.height);

    const result = await renderService.ditherImage({
      buffer: source.toBuffer("image/png"),
      epdOptimizeSettings: {
        intent: "readable",
        paletteName: "spectra6OriginalPalette",
      },
      size: {
        width: source.width,
        height: source.height,
        name: "landscape",
        frameKind: "openpaper13",
      },
    });

    const output = await loadImage(result.buffer);
    const outputCanvas = createCanvas(output.width, output.height);
    const outputContext = outputCanvas.getContext("2d");
    outputContext.drawImage(output, 0, 0);
    const pixels = outputContext.getImageData(
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    ).data;

    for (let index = 0; index < pixels.length; index += 4) {
      expect(Array.from(pixels.slice(index, index + 4))).toEqual([
        0, 255, 0, 255,
      ]);
    }
  });
});

describe("stored slideshow image dimensions", () => {
  const makeImage = (width: number, height: number, color: string) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    return canvas.toBuffer("image/png");
  };

  it.each(["portrait", "landscape"] as const)("preserves an already correctly sized %s device image byte for byte", async (orientation) => {
    const buffer = makeImage(800, 480, "black");
    const bufferOriginal = makeImage(800, 480, "white");
    const result = await renderService.prepareStoredImageForDevice({
      buffer, bufferOriginal, kind: "epd7", orientation,
    });
    expect(result.buffer).toBe(buffer);
    expect(result.bufferOriginal).toBe(bufferOriginal);
  });

  it.each(["portrait", "landscape"] as const)("rebuilds a missing %s device image from its original", async (orientation) => {
    const result = await renderService.prepareStoredImageForDevice({
      buffer: null, bufferOriginal: makeImage(200, 120, "white"), kind: "epd7", orientation,
    });
    const image = await loadImage(result.buffer);
    expect([image.width, image.height]).toEqual([800, 480]);
    const canvas = createCanvas(800, 480);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    expect(Array.from(context.getImageData(400, 240, 1, 1).data)).toEqual([255, 255, 255, 255]);
  });

  it.each([
    ["epd7", "landscape", 800, 480, undefined],
    ["epd7", "portrait", 800, 480, undefined],
    ["openpaper13", "landscape", 1600, 1200, undefined],
    ["openpaper13", "portrait", 1600, 1200, undefined],
    ["epd7", "landscape", 800, 480, "openpaper13"],
    ["epd7", "portrait", 800, 480, "openpaper13"],
    ["openpaper13", "landscape", 1600, 1200, "epd7"],
    ["openpaper13", "portrait", 1600, 1200, "epd7"],
  ] as const)("preserves panel colors when resizing for %s in %s (%i × %i, source %s)", async (kind, orientation, width, height, sourceFrameKind) => {
    const source = createCanvas(101, 61);
    const sourceContext = source.getContext("2d");
    const colors = ["#000000", "#ffffff", "#ff0000", "#ffff00", "#00ff00", "#0000ff"];
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        sourceContext.fillStyle = colors[(x + y) % colors.length];
        sourceContext.fillRect(x, y, 1, 1);
      }
    }
    // Distinct corners expose an accidental second rotation.
    sourceContext.fillStyle = "#ff0000";
    sourceContext.fillRect(0, 0, 4, 4);
    sourceContext.fillStyle = "#0000ff";
    sourceContext.fillRect(source.width - 4, source.height - 4, 4, 4);
    const bufferOriginal = makeImage(200, 120, "white");
    const result = await renderService.prepareStoredImageForDevice({
      buffer: source.toBuffer("image/png"), bufferOriginal, kind, orientation, sourceFrameKind,
    });
    expect(result.bufferOriginal).toBe(bufferOriginal);

    const image = await loadImage(result.buffer);
    expect([image.width, image.height]).toEqual([width, height]);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    const outputColors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      outputColors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
    }
    expect(outputColors).toEqual(new Set([
      "0,0,0,255", "255,255,255,255", "255,0,0,255",
      "255,255,0,255", "0,255,0,255", "0,0,255,255",
    ]));
    const rotatesForTarget = Boolean(sourceFrameKind && orientation === "landscape");
    expect(Array.from(pixels.slice(0, 4))).toEqual(rotatesForTarget ? [0, 0, 255, 255] : [255, 0, 0, 255]);
    expect(Array.from(pixels.slice(-4))).toEqual(rotatesForTarget ? [255, 0, 0, 255] : [0, 0, 255, 255]);

    // Subsequent slideshow rotations must keep the exact generated file.
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const replay = await renderService.prepareStoredImageForDevice({
        buffer: result.buffer, bufferOriginal, kind, orientation, sourceFrameKind: kind,
      });
      expect(replay.buffer).toBe(result.buffer);
    }
  });
});
