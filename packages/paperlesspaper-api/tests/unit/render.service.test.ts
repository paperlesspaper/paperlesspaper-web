import { afterEach, describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  getBrowserLaunchOptions,
  getRenderInitPayload,
} from "../../src/render/render.service";
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
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
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
