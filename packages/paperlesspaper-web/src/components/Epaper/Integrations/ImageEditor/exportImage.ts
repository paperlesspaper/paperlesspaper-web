type ExportCanvas = {
  width: number;
  height: number;
  viewportTransform: number[];
  enableRetinaScaling: boolean;
  skipControlsDrawing: boolean;
  toCanvasElement: (
    multiplier: number,
    options: { width: number; height: number }
  ) => HTMLCanvasElement;
  calcViewportBoundaries: () => unknown;
};

export type ImageExportFormat = "jpeg" | "png";

/** Render logical pixels, without selection controls or the editor's viewport zoom. */
export function renderImageCanvas(
  canvas: ExportCanvas,
  size: { width: number; height: number },
  maxSize?: number
): HTMLCanvasElement {
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  if (
    !canvas ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new Error("The editor has no image to export.");
  }

  const original = {
    width: canvas.width,
    height: canvas.height,
    viewportTransform: canvas.viewportTransform,
    enableRetinaScaling: canvas.enableRetinaScaling,
    skipControlsDrawing: canvas.skipControlsDrawing,
  };
  let rendered: HTMLCanvasElement;
  try {
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    const multiplier = maxSize
      ? Math.min(1, maxSize / Math.max(width, height))
      : 1;
    rendered = canvas.toCanvasElement(multiplier, { width, height });
  } finally {
    // Fabric's export temporarily changes canvas state. Restore it even if rendering fails.
    Object.assign(canvas, original);
    canvas.calcViewportBoundaries();
  }

  return rendered;
}

export async function exportImage(
  canvas: ExportCanvas,
  size: { width: number; height: number },
  format: ImageExportFormat
): Promise<File> {
  const rendered = renderImageCanvas(canvas, size);
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  if (format === "jpeg") {
    const context = rendered.getContext("2d");
    if (!context) throw new Error("Could not render the image.");
    context.save();
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  const type = `image/${format}`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    rendered.toBlob(
      (result) =>
        result && result.type === type
          ? resolve(result)
          : reject(new Error("Could not encode the image.")),
      type,
      0.95
    );
  });
  return new File(
    [blob],
    `paperlesspaper.${format === "jpeg" ? "jpg" : "png"}`,
    { type }
  );
}
