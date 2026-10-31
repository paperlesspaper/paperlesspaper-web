import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  aitjcizeSpectra6Palette,
  ditherImage as optimizeCanvas,
  replaceColors,
  suggestCanvasProcessingOptions,
} from "epdoptimize";
import type {
  AutoProcessingIntent,
  DitherImageOptions as EpdDitherImageOptions,
  PaletteColorEntry,
} from "epdoptimize";
import { resolveEpdOptimizePalette } from "./epdOptimizeMeta";
import type { EpdOptimizeMetaSettings } from "./epdOptimizeMeta";
import type {
  DeviceSize,
  GenerateImageOptions,
  Orientation,
  RenderResult,
} from "./render.types";
export type { PuppeteerRenderDiagnostics } from "./render.types";
import { getDeviceSize } from "./renderSize";
import { requestRender } from "./renderClient";

const generateImageFromUrl = async (
  options: GenerateImageOptions
): Promise<RenderResult> => {
  if (process.env.RENDER_SERVICE_SOCKET) {
    // Fail closed: a remote error must never launch Chromium in the API.
    return requestRender(options, process.env.RENDER_SERVICE_SOCKET);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("RENDER_SERVICE_SOCKET is required in production");
  }
  return (await import("./render.browser")).generateImageFromUrl(options);
};
type RenderDitherImageOptions = {
  buffer: Buffer;
  size?: { width: number; height: number; name?: string; frameKind?: string };
  palette?: PaletteColorEntry[];
  intent?: AutoProcessingIntent;
  options?: Partial<EpdDitherImageOptions>;
  epdOptimizeSettings?: EpdOptimizeMetaSettings;
};

type RenderResizeImageOptions = {
  buffer: Buffer;
  size: { width: number; height: number; name: string; frameKind?: string };
};

type ResizeImageToDeviceSizeOptions = {
  buffer: Buffer;
  kind: string;
  orientation?: Orientation;
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

const prepareStoredImageForDevice = async ({
  buffer,
  bufferOriginal,
  kind,
  sourceFrameKind,
  orientation = "portrait",
}: Omit<ResizeImageToDeviceSizeOptions, "buffer"> & {
  buffer: Buffer | null;
  bufferOriginal: Buffer;
  sourceFrameKind?: string;
}) => {
  const size = getDeviceSize({ kind, orientation });
  const image = buffer ? await loadImage(buffer) : null;
  // Dithering rotates both orientations into the panel's native dimensions.
  const panelSize = getDeviceSize({ kind, orientation: "landscape" });
  if (buffer && image) {
    // OpenPaper 13 uses the opposite landscape mounting from the other frames.
    const rotateForTarget =
      orientation === "landscape" &&
      sourceFrameKind &&
      (sourceFrameKind === "openpaper13") !== (kind === "openpaper13");
    if (
      image.width === panelSize.width &&
      image.height === panelSize.height &&
      !rotateForTarget
    ) {
      return { buffer, bufferOriginal };
    }

    // A stored device image is already color-corrected, dithered and rotated.
    // Resize its existing panel pixels without smoothing or another color pass.
    // Rebuilding from the preview/original would change the approved colors.
    const canvas = createCanvas(panelSize.width, panelSize.height);
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    if (rotateForTarget) {
      context.translate(panelSize.width, panelSize.height);
      context.rotate(Math.PI);
    }
    context.drawImage(image, 0, 0, panelSize.width, panelSize.height);
    return { buffer: canvas.toBuffer("image/png"), bufferOriginal };
  }

  // Only a missing device image needs to be generated from the source.
  const resized = await resizeImage({ buffer: bufferOriginal, size });
  const dithered = await ditherImage({ buffer: resized.buffer, size });
  return { buffer: dithered.buffer, bufferOriginal: resized.buffer };
};

const resolveDitherSize = async (
  buffer: Buffer,
  size?: RenderDitherImageOptions["size"]
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
  palette,
  intent,
  options,
  epdOptimizeSettings,
}: RenderDitherImageOptions): Promise<{
  buffer: Buffer;
  size: { width: number; height: number; name: string; frameKind?: string };
}> => {
  const resolvedSize = await resolveDitherSize(buffer, size);
  const ditherBuffer = await dither(buffer, resolvedSize, {
    enabled: epdOptimizeSettings?.enabled,
    intent: intent ?? epdOptimizeSettings?.intent,
    options: options ?? epdOptimizeSettings?.options,
    palette:
      palette ?? resolveEpdOptimizePalette(epdOptimizeSettings?.paletteName),
  });
  return { buffer: ditherBuffer, size: resolvedSize };
};

const dither = async (
  buffer: Buffer,
  size: { width: number; height: number; name: string; frameKind?: string },
  {
    enabled,
    intent,
    options = {},
    palette = aitjcizeSpectra6Palette,
  }: {
    enabled?: boolean;
    intent?: AutoProcessingIntent;
    options?: Partial<EpdDitherImageOptions>;
    palette?: PaletteColorEntry[];
  } = {}
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

  if (enabled === false) return canvas.toBuffer("image/png");

  const suggestion = suggestCanvasProcessingOptions(canvas, palette, {
    intent,
  });

  const ditheredCanvas = createCanvas(canvas.width, canvas.height);

  await optimizeCanvas(canvas, ditheredCanvas, {
    ...suggestion.ditherOptions,
    ...options,
    palette,
  });

  replaceColors(ditheredCanvas, canvas, palette);

  return canvas.toBuffer("image/png");
};

export default {
  generateImageFromUrl,
  resizeImageToDeviceSize,
  prepareStoredImageForDevice,
  ditherImage,
};
