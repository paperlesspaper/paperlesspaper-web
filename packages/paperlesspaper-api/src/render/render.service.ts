import puppeteer from "puppeteer";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  aitjcizeSpectra6Palette,
  ditherImage as optimizeCanvas,
  replaceColors,
  suggestCanvasProcessingOptions,
} from "epdoptimize";
import type { DitherImageOptions as EpdDitherImageOptions } from "epdoptimize";
import { deviceByKind } from "@paperlesspaper/helpers";
import { adBlock } from "./adBlock.service";

import type { Browser, Page } from "puppeteer";

type GenerateImageOptions = {
  token?: string;
  scroll?: number;
  url: string;
  orientation?: "portrait" | "landscape";
  data?: any;
  css?: string;
  kind: string;
  paper?: any;
};

type RenderDitherImageOptions = {
  buffer: Buffer;
  size?: { width: number; height: number; name?: string; frameKind?: string };
  palette?: EpdDitherImageOptions["palette"];
};

type RenderResizeImageOptions = {
  buffer: Buffer;
  size: { width: number; height: number; name: string; frameKind?: string };
};

type Orientation = "portrait" | "landscape";

type DeviceSize = {
  width: number;
  height: number;
  name: Orientation;
  frameKind: string;
};

type BrowserViewportSize = DeviceSize & {
  value: number;
};

type ResizeImageToDeviceSizeOptions = {
  buffer: Buffer;
  kind: string;
  orientation?: Orientation;
};

const OPENPAPER7_FALLBACK_SIZE = {
  width: 800,
  height: 480,
};

const resolveDeviceResolution = (
  kind?: string,
): { width: number; height: number } => {
  const requested = kind ? deviceByKind(kind) : null;
  const fallback = deviceByKind("epd7");

  const width =
    requested?.resolution?.width ||
    fallback?.resolution?.width ||
    OPENPAPER7_FALLBACK_SIZE.width;
  const height =
    requested?.resolution?.height ||
    fallback?.resolution?.height ||
    OPENPAPER7_FALLBACK_SIZE.height;

  return { width, height };
};

let sharedBrowser: Browser | null = null;
let sharedBrowserPromise: Promise<Browser> | null = null;

const launchSharedBrowser = async (): Promise<Browser> => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN,
    args: ["--no-sandbox"],
  });

  browser.on("disconnected", () => {
    sharedBrowser = null;
    sharedBrowserPromise = null;
  });

  sharedBrowser = browser;
  return browser;
};

const getBrowser = async (): Promise<Browser> => {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchSharedBrowser().catch((error) => {
      sharedBrowserPromise = null;
      throw error;
    });
  }

  return sharedBrowserPromise;
};

const generateImageFromUrl = async ({
  token,
  scroll = 0,
  url,
  orientation = "portrait",
  data,
  paper,
  css,
  kind = "epd7",
}: GenerateImageOptions): Promise<{
  buffer: Buffer | null;
  size: DeviceSize;
}> => {
  const { width: initWidth, height: initHeight } =
    resolveDeviceResolution(kind);

  const rotationList: Record<Orientation, BrowserViewportSize> = {
    portrait: {
      name: "portrait",
      value: 9,
      width: initHeight,
      height: initWidth,
      frameKind: kind,
    },
    landscape: {
      name: "landscape",
      value: 0,
      width: initWidth,
      height: initHeight,
      frameKind: kind,
    },
  };

  const size = rotationList[orientation];

  let page: Page | null = null;

  const appsBaseUrl =
    process.env.PAPERLESSPAPER_APPS_URL || "https://apps.paperlesspaper.de";
  const urlLocal =
    appsBaseUrl === "https://apps.paperlesspaper.de"
      ? url
      : url.replace("https://apps.paperlesspaper.de", appsBaseUrl);

  try {
    const browser = await getBrowser();
    //console.log('Navigating to URL:', urlLocal);
    //const context = await browser.createIncognitoBrowserContext();
    //page = await context.newPage();

    page = await browser.newPage();
    await page.setViewport({
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
    });

    await page.goto(urlLocal, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 5000 })
      .catch(() => undefined);
    //console.log('Page loaded:', urlLocal);

    await adBlock(page);
    //console.log('AdBlock applied');

    await new Promise((resolve) => setTimeout(resolve, 500));

    const loadingElementExists =
      (await page.$("#website-has-loading-element")) !== null;

    //console.log('Checking for loading element:', loadingElementExists);

    if (data && paper?.kind !== "plugin") {
      await page.evaluate((payload) => {
        window.postMessage(
          { cmd: "message", data: payload, type: "GOOGLECALENDAR" },
          "*",
        );
      }, data);
    }

    console.log("Data posted to page, waiting for content to render...", paper);
    if (paper) {
      await page.evaluate((payload) => {
        window.postMessage(
          { cmd: "message", data: payload, type: "INIT" },
          "*",
        );
      }, paper);
    }

    if (loadingElementExists) {
      //console.log("Loading element detected, waiting for 'website-has-loaded' to appear...");
      try {
        await page.waitForSelector("#website-has-loaded", { timeout: 15000 });
        //console.log("'website-has-loaded' appeared.");
      } catch (error) {
        //console.warn("'website-has-loaded' did not appear within timeout", error);
      }
    } else {
      //console.log('No loading element detected, waiting for 8.5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    //console.log('render finished:', scroll);
    if (css) {
      await page.addStyleTag({
        content: `${css}`,
      });
    }

    const buffer = Buffer.from(await page.screenshot());

    if (token) {
      await page.evaluate(() => {
        localStorage.setItem("print-token", "");
      });
    }
    return { buffer, size };
  } catch (error) {
    console.error("Render error:", {
      url,
      urlLocal,
      appsBaseUrl,
      message: error instanceof Error ? error.message : String(error),
    });
    return { buffer: null, size };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        //console.log('Page close error:', closeError);
      }
    }
  }
};

const getDeviceSize = ({
  kind,
  orientation = "portrait",
}: {
  kind: string;
  orientation?: Orientation;
}): DeviceSize => {
  const { width: initWidth, height: initHeight } =
    resolveDeviceResolution(kind);

  const rotationList: Record<Orientation, DeviceSize> = {
    portrait: {
      name: "portrait",
      width: initHeight,
      height: initWidth,
      frameKind: kind,
    },
    landscape: {
      name: "landscape",
      width: initWidth,
      height: initHeight,
      frameKind: kind,
    },
  };

  return rotationList[orientation];
};

const resizeImage = async ({
  buffer,
  size,
}: RenderResizeImageOptions): Promise<{
  buffer: Buffer;
  size: RenderResizeImageOptions["size"];
}> => {
  const canvas = createCanvas(size.width, size.height);
  const context = canvas.getContext("2d");

  context.fillStyle = "#000";
  context.fillRect(0, 0, size.width, size.height);

  const image = await loadImage(buffer);
  context.drawImage(image, 0, 0, size.width, size.height);

  return { buffer: canvas.toBuffer("image/png"), size };
};

const resizeImageToDeviceSize = async ({
  buffer,
  kind,
  orientation = "portrait",
}: ResizeImageToDeviceSizeOptions): Promise<{
  buffer: Buffer;
  size: DeviceSize;
}> => {
  const size = getDeviceSize({ kind, orientation });
  const resized = await resizeImage({ buffer, size });
  return { buffer: resized.buffer, size };
};

const resolveDitherSize = async (
  buffer: Buffer,
  size?: RenderDitherImageOptions["size"],
): Promise<{
  width: number;
  height: number;
  name: string;
  frameKind?: string;
}> => {
  if (size?.width && size?.height) {
    return {
      width: size.width,
      height: size.height,
      name: size.name || (size.height > size.width ? "portrait" : "landscape"),
      frameKind: size.frameKind,
    };
  }

  const image = await loadImage(buffer);
  return {
    width: image.width,
    height: image.height,
    name: image.height > image.width ? "portrait" : "landscape",
  };
};

const ditherImage = async ({
  buffer,
  size,
}: RenderDitherImageOptions): Promise<{
  buffer: Buffer;
  size: { width: number; height: number; name: string; frameKind?: string };
}> => {
  const resolvedSize = await resolveDitherSize(buffer, size);
  const ditherBuffer = await dither(buffer, resolvedSize);
  return { buffer: ditherBuffer, size: resolvedSize };
};

const pickDitherOptions = (
  options?: Partial<EpdDitherImageOptions>,
): Omit<EpdDitherImageOptions, "palette"> => {
  const next: Omit<EpdDitherImageOptions, "palette"> = {};

  if (!options) return next;

  if (options.ditheringType) next.ditheringType = options.ditheringType;
  if (options.errorDiffusionMatrix) {
    next.errorDiffusionMatrix = options.errorDiffusionMatrix;
  }
  if (options.algorithm) next.algorithm = options.algorithm;
  if (typeof options.serpentine === "boolean") {
    next.serpentine = options.serpentine;
  }
  if (options.orderedDitheringType) {
    next.orderedDitheringType = options.orderedDitheringType;
  }
  if (Array.isArray(options.orderedDitheringMatrix)) {
    next.orderedDitheringMatrix = options.orderedDitheringMatrix;
  }
  if (options.randomDitheringType) {
    next.randomDitheringType = options.randomDitheringType;
  }
  if (options.colorMatching) next.colorMatching = options.colorMatching;
  if (typeof options.sampleColorsFromImage === "boolean") {
    next.sampleColorsFromImage = options.sampleColorsFromImage;
  }
  if (typeof options.numberOfSampleColors === "number") {
    next.numberOfSampleColors = options.numberOfSampleColors;
  }

  return next;
};

const dither = async (
  buffer: Buffer,
  size: { width: number; height: number; name: string; frameKind?: string },
): Promise<Buffer> => {
  let canvas = createCanvas(size.width, size.height);
  const context = canvas.getContext("2d");

  context.fillStyle = "#000";
  context.fillRect(0, 0, size.width, size.height);

  const image = await loadImage(buffer);

  context.drawImage(image, 0, 0, size.width, size.height);

  const rotatedCanvas = createCanvas(size.height, size.width);
  const rotatedContext = rotatedCanvas.getContext("2d");

  if (size.name === "portrait") {
    rotatedCanvas.width = canvas.height;
    rotatedCanvas.height = canvas.width;

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedContext.rotate(Math.PI / 2);
    rotatedContext.translate(-canvas.width / 2, -canvas.height / 2);
  } else {
    rotatedCanvas.width = canvas.width;
    rotatedCanvas.height = canvas.height;

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    const rotationAngleLandscape =
      size.frameKind === "openpaper13" ? 0 : Math.PI;
    rotatedContext.rotate(rotationAngleLandscape);
    rotatedContext.translate(-canvas.width / 2, -canvas.height / 2);
  }

  rotatedContext.drawImage(canvas, 0, 0);
  canvas = rotatedCanvas;

  const suggestion = suggestCanvasProcessingOptions(
    canvas,
    aitjcizeSpectra6Palette,
  );

  const ditheredCanvas = createCanvas(canvas.width, canvas.height);

  await optimizeCanvas(canvas, ditheredCanvas, {
    ...pickDitherOptions(suggestion.ditherOptions),
    palette: aitjcizeSpectra6Palette,
  });

  replaceColors(ditheredCanvas, canvas, aitjcizeSpectra6Palette);

  return canvas.toBuffer("image/png");
};

export default {
  generateImageFromUrl,
  resizeImageToDeviceSize,
  ditherImage,
};
