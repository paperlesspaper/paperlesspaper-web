import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import renderService from "../../src/render/render.service";

describe("readable layout colors", () => {
  it("preserves a small blue heading on a mostly white 13-inch calendar", async () => {
    const canvas = createCanvas(545, 1200),
      ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 545, 1200);
    // Synthetic calendar captured by layout-render.test.ts at a 529 × 1200 slot size.
    // Keep the exact raster: the regression depends on sparse color sampling.
    ctx.drawImage(await loadImage(new URL("../fixtures/layout-calendar-sparse.png", import.meta.url).pathname), 0, 0);
    const result = await renderService.ditherImage({
      buffer: canvas.toBuffer("image/png"),
      size: {
        width: 545,
        height: 1200,
        name: "landscape",
        frameKind: "openpaper13",
      },
      rotate: false,
      regions: [
        {
          id: "calendar",
          x: 0,
          y: 0,
          width: 529,
          height: 1200,
          settings: {
            intent: "readable",
            options: { ditheringType: "quantizationOnly" },
          },
        },
        {
          id: "margin",
          x: 529,
          y: 0,
          width: 16,
          height: 1200,
          settings: { enabled: false },
        },
      ],
    });
    ctx.drawImage(await loadImage(result.buffer), 0, 0);
    const pixels = ctx.getImageData(14, 45, 200, 40).data;
    let blue = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 255)
        blue++;
    expect(blue).toBeGreaterThan(500);
    expect(Array.from(ctx.getImageData(400, 900, 1, 1).data)).toEqual([
      255, 255, 255, 255,
    ]);
  });
});
