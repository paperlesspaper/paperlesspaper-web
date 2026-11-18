import {
  parseEpdOptimizeMetaContent,
  type EpdOptimizeMetaSettings,
} from "./epdOptimizeMeta";

export interface RenderRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  settings?: EpdOptimizeMetaSettings;
}

/** Treat layout metadata as untrusted: exact pixels, bounded count, no overlaps. */
export function parseRenderRegions(
  content: string | null,
  size: { width: number; height: number }
): RenderRegion[] | undefined {
  if (content === null) return undefined;
  if (content.length > 32_000)
    throw new Error("Layout region metadata is too large");
  const values = JSON.parse(content);
  if (!Array.isArray(values) || values.length < 2 || values.length > 4)
    throw new Error("Expected two to four layout regions");
  const regions: RenderRegion[] = [];
  for (const value of values) {
    if (
      !value ||
      typeof value.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,31}$/.test(value.id) ||
      regions.some((region) => region.id === value.id) ||
      ![value.x, value.y, value.width, value.height].every(Number.isInteger) ||
      value.width < 16 ||
      value.height < 16 ||
      value.x < 0 ||
      value.y < 0 ||
      value.x + value.width > size.width ||
      value.y + value.height > size.height
    )
      throw new Error("Invalid layout region bounds");
    if (
      regions.some(
        (region) =>
          value.x < region.x + region.width &&
          value.x + value.width > region.x &&
          value.y < region.y + region.height &&
          value.y + value.height > region.y
      )
    )
      throw new Error("Layout regions must not overlap");
    regions.push({
      id: value.id,
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
      settings: parseEpdOptimizeMetaContent(
        typeof value.processing === "string" ? value.processing : undefined
      ),
    });
  }
  return regions;
}
