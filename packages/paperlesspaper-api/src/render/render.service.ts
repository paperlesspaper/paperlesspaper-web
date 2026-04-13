import puppeteer from "puppeteer";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { dither as ditherCanvas, deviceByKind } from "@paperlesspaper/helpers";
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
};

type DitherImageOptions = {
  buffer: Buffer;
  size: { width: number; height: number; name: string };
};

type Orientation = "portrait" | "landscape";

type DeviceSize = {
  width: number;
  height: number;
  name: Orientation;
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
  css,
  kind = "epd7",
}: GenerateImageOptions): Promise<{
  buffer: Buffer | null;
  size: { width: number; height: number };
}> => {
  const { width: initWidth, height: initHeight } =
    resolveDeviceResolution(kind);

  const rotationList = {
    portrait: {
      name: "portrait",
      value: 9,
      width: initHeight,
      height: initWidth,
    },
    landscape: {
      name: "landscape",
      value: 0,
      width: initWidth,
      height: initHeight,
    },
  };

  const size = rotationList[orientation];

  const domain = process.env.FRONTEND_URL;
  let page: Page | null = null;

  const urlLocal =
    process.env.NODE_ENV === "production"
      ? url
      : url.replace("https://apps.paperlesspaper.de", "http://localhost:3001");

  try {
    const browser = await getBrowser();

    page = await browser.newPage();
    await page.setViewport({
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
    });
    //console.log('Navigating to URL:', urlLocal);
    await page.goto(urlLocal, { waitUntil: "networkidle0", timeout: 5000 });
    //console.log('Page loaded:', urlLocal);

    await adBlock(page);
    //console.log('AdBlock applied');

    await new Promise((resolve) => setTimeout(resolve, 500));

    const loadingElementExists =
      (await page.$("#website-has-loading-element")) !== null;

    //console.log('Checking for loading element:', loadingElementExists);

    if (data) {
      await page.evaluate((payload) => {
        window.postMessage({ cmd: "message", data: payload }, "*");
      }, data);
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

    const buffer = await page.screenshot();

    if (token) {
      await page.evaluate(() => {
        localStorage.setItem("print-token", "");
      });
    }
    return { buffer, size };
  } catch (error) {
    //console.log('Render error:', error);
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
    },
    landscape: {
      name: "landscape",
      width: initWidth,
      height: initHeight,
    },
  };

  return rotationList[orientation];
};

const resizeImage = async ({
  buffer,
  size,
}: DitherImageOptions): Promise<{ buffer: Buffer; size: typeof size }> => {
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

const ditherImage = async ({
  buffer,
  size,
}: DitherImageOptions): Promise<{ buffer: Buffer; size: typeof size }> => {
  const ditherBuffer = await dither(buffer, size);
  return { buffer: ditherBuffer, size };
};

const colorsReal = [
  "#191E21", // black
  "#C6C3C2", // white
  "#30304C", // blue
  "#3C5330", // green
  "#6A181A", // red
  "#7D3024", // orange
  "#976D2E", // yellow
];

const colorsMap = [
  "#000", // black
  "#fff", // white
  "#0000FF", // blue
  "#00FF00", // green
  "#FF0000", // red
  "#FF8000", // orange
  "#FFFF00", // yellow
];

const ditheringType = "errorDiffusion";

const dither = async (
  buffer: Buffer,
  size: { width: number; height: number; name: string },
): Promise<Buffer> => {
  const options = {
    errorDiffusionMatrix: "floydSteinberg",
    ditheringType,
    palette: colorsMap,
  };

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
    rotatedContext.rotate(Math.PI);
    rotatedContext.translate(-canvas.width / 2, -canvas.height / 2);
  }

  rotatedContext.drawImage(canvas, 0, 0);
  canvas = rotatedCanvas;

  await ditherCanvas(canvas, canvas, options);

  return canvas.toBuffer("image/png");
};

export default {
  generateImageFromUrl,
  resizeImageToDeviceSize,
  ditherImage,
};
