import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  getBrowserLaunchOptions,
  getRenderInitPayload,
  emulatePageTimezone,
} from "../../src/render/render.browser";
import renderService from "../../src/render/render.service";
import {
  parseEpdOptimizeMetaContent,
  resolveWebsiteEpdOptimizeSettings,
} from "../../src/render/epdOptimizeMeta";

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
    vi.unstubAllEnvs();
  });

  it("uses the configured headless shell executable", () => {
    vi.stubEnv("RENDERER_DISABLE_CHROMIUM_SANDBOX", undefined);
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
  it("only disables Chromium sandbox for the explicit isolated-container setting", () => {
    vi.stubEnv("RENDERER_DISABLE_CHROMIUM_SANDBOX", "true");
    const options = getBrowserLaunchOptions();
    expect(options.args).toContain("--no-sandbox");
    expect(options.args).toContain("--proxy-server=http://127.0.0.1:9");
    expect(options.args).toContain("--proxy-bypass-list=<-loopback>");
    vi.stubEnv("RENDERER_DISABLE_CHROMIUM_SANDBOX", "false");
    expect(getBrowserLaunchOptions().args).not.toContain("--no-sandbox");
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
  it.each([true, false, { enabled: true, colorTolerance: 10, edgeContrast: 36 }])(
    "accepts text/graphics protection in integration metadata: %j",
    (protectTextAndGraphics) => {
      for (const config of [
        { protectTextAndGraphics },
        { options: { protectTextAndGraphics } },
        { canvasDitherOptions: { protectTextAndGraphics } },
      ]) {
        expect(parseEpdOptimizeMetaContent(JSON.stringify(config))).toEqual({
          options: { protectTextAndGraphics },
        });
      }
    },
  );

  it("protects websites by default and preserves explicit integration options", () => {
    expect(resolveWebsiteEpdOptimizeSettings(undefined, { kind: "website" }))
      .toEqual({ options: { protectTextAndGraphics: true } });
    expect(resolveWebsiteEpdOptimizeSettings(undefined, { kind: "plugin" }))
      .toBeUndefined();
    const settings = { options: { protectTextAndGraphics: false } };
    expect(resolveWebsiteEpdOptimizeSettings(settings, { kind: "website" }))
      .toEqual(settings);
    expect(resolveWebsiteEpdOptimizeSettings(settings, {
      kind: "plugin", meta: { protectTextAndGraphics: false },
    })).toBe(settings);
    expect(resolveWebsiteEpdOptimizeSettings(settings, {
      kind: "website", meta: { protectTextAndGraphics: "false" },
    })).toEqual(settings);
  });

  it.each([true, false])("applies a saved website preference (%s) without losing other options", (protection) => {
    const settings = {
      enabled: false,
      intent: "readable" as const,
      paletteName: "spectra6OriginalPalette" as const,
      options: { serpentine: false, protectTextAndGraphics: !protection },
    };
    expect(resolveWebsiteEpdOptimizeSettings(settings, {
      kind: "website", meta: { protectTextAndGraphics: protection },
    })).toEqual({
      ...settings,
      options: { serpentine: false, protectTextAndGraphics: protection },
    });
  });

  it("keeps flat website graphics clean while still dithering gradients", async () => {
    const source = createCanvas(320, 240);
    const ctx = source.getContext("2d");
    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = "#222222";
    for (let y = 24; y < 200; y += 36) {
      ctx.fillRect(20, y, 80, 8);
      ctx.fillRect(20, y + 12, 100, 4);
    }
    const gradient = ctx.createLinearGradient(160, 0, 310, 0);
    gradient.addColorStop(0, "#444444");
    gradient.addColorStop(1, "#bbbbbb");
    ctx.fillStyle = gradient;
    ctx.fillRect(160, 10, 150, 220);
    const process = async (protection: boolean) => {
      const result = await renderService.ditherImage({
        buffer: source.toBuffer("image/png"),
        rotate: false,
        epdOptimizeSettings: parseEpdOptimizeMetaContent(JSON.stringify({
          palette: "genericTwoColorEinkPalette",
          options: {
            protectTextAndGraphics: protection,
            ditheringType: "errorDiffusion",
            processingEngine: "js",
            toneMapping: { exposure: 0, contrast: 0, saturation: 0 },
            dynamicRangeCompression: false,
            levelCompression: { mode: "off" },
            edgePreservation: { enabled: false },
            edgeAntialiasing: { enabled: false },
          },
        })),
      });
      const output = createCanvas(320, 240);
      output.getContext("2d").drawImage(await loadImage(result.buffer), 0, 0);
      return output.getContext("2d");
    };
    const protectedOutput = await process(true);
    const ordinaryOutput = await process(false);
    const colorsIn = (context: typeof ctx, x: number, y: number, w: number, h: number) => {
      const pixels = context.getImageData(x, y, w, h).data;
      const colors = new Set<string>();
      for (let i = 0; i < pixels.length; i += 4) {
        colors.add(Array.from(pixels.slice(i, i + 4)).join(","));
      }
      return colors;
    };
    expect(colorsIn(protectedOutput, 5, 5, 140, 12)).toEqual(new Set(["255,255,255,255"]));
    expect(colorsIn(ordinaryOutput, 5, 5, 140, 12).size).toBeGreaterThan(1);
    expect(colorsIn(protectedOutput, 22, 26, 76, 4)).toEqual(new Set(["0,0,0,255"]));
    expect(colorsIn(protectedOutput, 220, 30, 8, 160).size).toBe(2);
    expect(colorsIn(protectedOutput, 0, 0, 320, 240)).toEqual(new Set([
      "0,0,0,255", "255,255,255,255",
    ]));
  });

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
