import { describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { parseRenderRegions } from "../../src/render/renderRegions";
import renderService from "../../src/render/render.service";
const sourceRegions = [
  {
    id: "photo",
    x: 0,
    y: 0,
    width: 16,
    height: 32,
    processing:
      '{"intent":"natural","options":{"ditheringType":"errorDiffusion"}}',
  },
  {
    id: "calendar",
    x: 16,
    y: 0,
    width: 16,
    height: 32,
    processing:
      '{"intent":"readable","options":{"ditheringType":"quantizationOnly","protectTextAndGraphics":true}}',
  },
];
describe("region rendering", () => {
  it("preserves protection options for individual integration regions", () => {
    const regions = parseRenderRegions(JSON.stringify(sourceRegions), { width: 32, height: 32 })!;
    expect(regions[0].settings?.options?.protectTextAndGraphics).toBeUndefined();
    expect(regions[1].settings?.options?.protectTextAndGraphics).toBe(true);
  });
  it("keeps server previews in logical portrait dimensions", async () => {
    const canvas = createCanvas(32, 48); const ctx = canvas.getContext("2d");
    ctx.fillStyle = "red"; ctx.fillRect(0, 0, 16, 48); ctx.fillStyle = "blue"; ctx.fillRect(16, 0, 16, 48);
    const regions = sourceRegions.map(region => ({ ...region, height: 48, settings: { enabled: false } }));
    const preview = await renderService.ditherImage({ buffer: canvas.toBuffer("image/png"), size: { width: 32, height: 48, name: "portrait" }, regions, rotate: false });
    const panel = await renderService.ditherImage({ buffer: canvas.toBuffer("image/png"), size: { width: 32, height: 48, name: "portrait" }, regions });
    expect([(await loadImage(preview.buffer)).width, (await loadImage(preview.buffer)).height]).toEqual([32, 48]);
    expect([(await loadImage(panel.buffer)).width, (await loadImage(panel.buffer)).height]).toEqual([48, 32]);
    const actual = createCanvas(32, 48); actual.getContext("2d").drawImage(await loadImage(preview.buffer), 0, 0);
    expect(actual.getContext("2d").getImageData(0, 0, 32, 48).data).toEqual(ctx.getImageData(0, 0, 32, 48).data);
  });
  it.each([
    [{ ...sourceRegions[0], x: -1 }, sourceRegions[1]],
    [sourceRegions[0], { ...sourceRegions[1], x: 15 }],
    [sourceRegions[0], { ...sourceRegions[1], width: 17 }],
    [sourceRegions[0], { ...sourceRegions[1], x: 16.5 }],
    [sourceRegions[0], { ...sourceRegions[1], id: "photo" }],
  ])("rejects invalid or overlapping geometry", (...regions) => {
    expect(() =>
      parseRenderRegions(JSON.stringify(regions), { width: 32, height: 32 })
    ).toThrow();
  });
  it("processes each crop exactly once and rotates only the assembled frame", async () => {
    const canvas = createCanvas(32, 32),
      context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 16, 32);
    gradient.addColorStop(0, "#2288aa");
    gradient.addColorStop(1, "#ffaa33");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 32);
    context.fillStyle = "white";
    context.fillRect(16, 0, 16, 32);
    context.fillStyle = "black";
    context.fillRect(20, 5, 3, 20);
    const regions = parseRenderRegions(JSON.stringify(sourceRegions), {
      width: 32,
      height: 32,
    })!;
    const result = await renderService.ditherImage({
      buffer: canvas.toBuffer("image/png"),
      size: {
        width: 32,
        height: 32,
        name: "landscape",
        frameKind: "openpaper13",
      },
      regions,
    });
    const actual = createCanvas(32, 32);
    actual.getContext("2d").drawImage(await loadImage(result.buffer), 0, 0);
    for (const region of regions) {
      const crop = createCanvas(region.width, region.height);
      crop
        .getContext("2d")
        .drawImage(
          canvas,
          region.x,
          region.y,
          region.width,
          region.height,
          0,
          0,
          region.width,
          region.height
        );
      const expected = await renderService.ditherImage({
        buffer: crop.toBuffer("image/png"),
        size: {
          width: region.width,
          height: region.height,
          name: "landscape",
          frameKind: "openpaper13",
        },
        epdOptimizeSettings: region.settings,
      });
      crop.getContext("2d").drawImage(await loadImage(expected.buffer), 0, 0);
      expect(
        actual
          .getContext("2d")
          .getImageData(region.x, region.y, region.width, region.height).data
      ).toEqual(
        crop.getContext("2d").getImageData(0, 0, region.width, region.height)
          .data
      );
    }
    const rotated = await renderService.ditherImage({
      buffer: canvas.toBuffer("image/png"),
      size: { width: 32, height: 32, name: "portrait" },
      regions,
    });
    const expectedRotation = await renderService.ditherImage({
      buffer: result.buffer,
      size: { width: 32, height: 32, name: "portrait" },
      epdOptimizeSettings: { enabled: false },
    });
    expect(rotated.buffer).toEqual(expectedRotation.buffer);
  });
  it("rejects raw regions containing colors outside the device palette", async () => {
    const canvas = createCanvas(32, 32);
    const context = canvas.getContext("2d");
    context.fillStyle = "#123456";
    context.fillRect(0, 0, 32, 32);
    const regions = parseRenderRegions(JSON.stringify(sourceRegions), {
      width: 32,
      height: 32,
    })!;
    regions[0].settings = { enabled: false };
    await expect(
      renderService.ditherImage({
        buffer: canvas.toBuffer("image/png"),
        regions,
      })
    ).rejects.toThrow("device colors");
  });
});
