import puppeteer from "puppeteer";
import { createCanvas, loadImage } from "canvas";
import { dither as ditherCanvas, deviceByKind } from "@paperlesspaper/helpers";
import { adBlock } from "./adBlock.service.js";

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
  const deviceMeta = deviceByKind(kind);
  const initWidth = deviceMeta.resolution.width;
  const initHeight = deviceMeta.resolution.height;

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
  let browser: Browser | null = null;
  let page: Page | null = null;

  const urlLocal =
    process.env.NODE_ENV === "production"
      ? url
      : url.replace("https://apps.paperlesspaper.de", "http://localhost:3001");

  try {
    browser = await puppeteer.launch({
      defaultViewport: {
        width: size.width,
        height: size.height,
        deviceScaleFactor: 1,
      },
      executablePath: process.env.CHROME_BIN,
      args: ["--no-sandbox"],
    });

    page = await browser.newPage();
    //console.log('Navigating to URL:', urlLocal);
    await page.goto(urlLocal, { waitUntil: "networkidle2", timeout: 5000 });
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
        await page.waitForSelector("#website-has-loaded", { timeout: 5000 });
        //console.log("'website-has-loaded' appeared.");
      } catch (error) {
        //console.warn("'website-has-loaded' did not appear within timeout", error);
      }
    } else {
      //console.log('No loading element detected, waiting for 8.5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 8500));
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
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        //console.log('Browser close error:', closeError);
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
  const deviceMeta = deviceByKind(kind);
  const initWidth = deviceMeta.resolution.width;
  const initHeight = deviceMeta.resolution.height;

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
