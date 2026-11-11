import { expect, it } from "vitest";
import { Rect } from "fabric";
import { resizeImageForOrientation } from "../../src/components/Epaper/Integrations/ImageEditor/imageOrientation";

const portrait = { width: 480, height: 800 };
const landscape = { width: 800, height: 480 };

it("keeps a frame-filling photograph covered when changing orientation", () => {
  const image = new Rect({
    width: 600,
    height: 1000,
    strokeWidth: 0,
    originX: "center",
    originY: "center",
    left: 240,
    top: 400,
    scaleX: 0.8,
    scaleY: 0.8,
  });
  resizeImageForOrientation(image, portrait, landscape);
  const bounds = image.getBoundingRect();
  expect(bounds.left).toBeCloseTo(0);
  expect(bounds.top).toBeLessThanOrEqual(0);
  expect(bounds.left + bounds.width).toBeCloseTo(800);
  expect(bounds.top + bounds.height).toBeGreaterThanOrEqual(480);
});

it.each([0, 90, 33])(
  "preserves crop zoom and offset over repeated orientation changes at %i degrees",
  (angle) => {
    const image = new Rect({
      width: 600,
      height: 1000,
      angle,
      strokeWidth: 0,
      originX: "left",
      originY: "top",
      left: -50,
      top: -80,
      scaleX: 1.4,
      scaleY: 1.4,
    });
    const before = image.toObject();
    for (let i = 0; i < 10; i++) {
      resizeImageForOrientation(image, portrait, landscape);
      resizeImageForOrientation(image, landscape, portrait);
    }
    for (const key of ["left", "top", "scaleX", "scaleY", "angle"] as const) {
      expect(image[key]).toBeCloseTo(before[key], 8);
    }
  }
);
