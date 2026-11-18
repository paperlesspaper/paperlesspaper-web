// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { exportImage, renderImageCanvas } from "../../src/components/Epaper/Integrations/ImageEditor/exportImage";

function setup() {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    globalCompositeOperation: "source-over",
  };
  const rendered = {
    getContext: () => context,
    toBlob: vi.fn((callback, type) => callback(new Blob(["image"], { type }))),
  };
  const canvas = {
    width: 300,
    height: 200,
    viewportTransform: [0.5, 0, 0, 0.5, 20, 30],
    enableRetinaScaling: true,
    skipControlsDrawing: false,
    calcViewportBoundaries: vi.fn(),
    toCanvasElement: vi.fn(() => rendered),
  };
  return { canvas, rendered, context };
}

afterEach(() => vi.restoreAllMocks());
it.each(["png", "jpeg"] as const)(
  "exports %s with logical dimensions and restores editor state",
  async (format) => {
    const { canvas, context } = setup();
    const before = { ...canvas };
    const file = await exportImage(
      canvas as any,
      { width: 1200, height: 800 },
      format,
    );
    expect(canvas.toCanvasElement).toHaveBeenCalledWith(1, {
      width: 1200,
      height: 800,
    });
    expect(canvas).toEqual(before);
    expect(file.type).toBe(`image/${format}`);
    expect(file.name).toBe(
      format === "jpeg" ? "paperlesspaper.jpg" : "paperlesspaper.png",
    );
    if (format === "jpeg") {
      expect(context.fillStyle).toBe("#ffffff");
      expect(context.globalCompositeOperation).toBe("destination-over");
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1200, 800);
    } else expect(context.fillRect).not.toHaveBeenCalled();
  },
);
it("restores the editor even if Fabric fails during rendering", async () => {
  const { canvas } = setup();
  const before = { ...canvas };
  canvas.toCanvasElement.mockImplementation(() => {
    canvas.width = 9999;
    canvas.skipControlsDrawing = true;
    canvas.enableRetinaScaling = false;
    throw new Error("render failed");
  });
  await expect(
    exportImage(canvas as any, { width: 1200, height: 800 }, "png"),
  ).rejects.toThrow("render failed");
  expect(canvas).toEqual(before);
});
it("reports failed encoding instead of downloading an empty file", async () => {
  const { canvas, rendered } = setup();
  rendered.toBlob.mockImplementation((callback) => callback(null));
  await expect(
    exportImage(canvas as any, { width: 1200, height: 800 }, "png"),
  ).rejects.toThrow("encode");
});

it("renders a bounded thumbnail of the logical crop without changing the viewport", () => {
  const { canvas, rendered } = setup();
  const before = { ...canvas };
  expect(renderImageCanvas(canvas as any, { width: 800, height: 480 }, 360)).toBe(rendered);
  expect(canvas.toCanvasElement).toHaveBeenCalledWith(0.45, { width: 800, height: 480 });
  expect(canvas).toEqual(before);
});
