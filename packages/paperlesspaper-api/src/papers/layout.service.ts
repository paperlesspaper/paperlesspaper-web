import { randomUUID } from "node:crypto";
import { z } from "zod";

export const LAYOUT_RENDER_URL =
  process.env.LAYOUT_RENDER_URL ||
  "https://integrations.paperlesspaper.de/layout/render.html";
export const layoutPreviewQuerySchema = z
  .object({
    organization: z.string().regex(/^[a-f\d]{24}$/i),
    mode: z.enum(["resolve", "render"]).optional(),
    frameKind: z.string().max(100).optional(),
    orientation: z.enum(["portrait", "landscape"]).optional(),
  })
  .strict();

export const layoutSettingsSchema = z
  .object({
    layout: z.enum(["columns", "rows", "grid", "custom"]).default("columns"),
    ratio: z.number().min(0.25).max(4).default(2),
    gap: z.number().int().min(0).max(64).default(8),
    html: z.string().max(32_000).default(""),
    css: z.string().max(32_000).default(""),
    color: z.string().max(32).default("blue-light"),
    regions: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
          paperId: z.string().regex(/^[a-f\d]{24}$/i),
          processing: z
            .enum(["inherit", "photo", "readable", "quantization"])
            .default("inherit"),
          fit: z.enum(["cover", "contain"]).default("cover"),
          focalX: z.number().min(0).max(100).default(50),
          focalY: z.number().min(0).max(100).default(50),
        })
      )
      .min(2)
      .max(4),
  })
  .refine(
    (value) =>
      new Set(value.regions.map((region) => region.id)).size ===
      value.regions.length,
    "Slot names must be unique"
  );

export interface LayoutResolverDependencies {
  loadPaper: (id: string, organization: string) => Promise<any>;
  imageUrl: (id: string) => Promise<string>;
  resolveIntegration: (
    paper: any
  ) => Promise<{ url: string; payload: Record<string, unknown> }>;
}

/** Used by both authenticated preview and scheduled device renders. Never trusts browser-provided URLs/data. */
export async function resolveLayoutPayload(
  paper: any,
  dependencies: LayoutResolverDependencies
) {
  const settings = layoutSettingsSchema.parse(paper.meta);
  const organization = String(paper.organization || "");
  if (!/^[a-f\d]{24}$/i.test(organization))
    throw new Error("Layout organization is required");
  // Validate every reference before fetching data or signing any source URL.
  const sources = await Promise.all(
    settings.regions.map((region) =>
      dependencies.loadPaper(region.paperId, organization)
    )
  );
  sources.forEach((source, index) => {
    if (!source || String(source.organization) !== organization)
      throw new Error(
        `Content for slot ${settings.regions[index].id} is unavailable`
      );
    if (["layout", "slides", "playlist", "printer"].includes(source.kind))
      throw new Error(
        "Layouts cannot contain other layouts, slideshows, playlists or printer contents"
      );
  });
  const regions = await Promise.all(
    settings.regions.map(async (region, index) => {
      const source = sources[index];
      if (source.kind === "image")
        return {
          ...region,
          type: "image",
          url: await dependencies.imageUrl(region.paperId),
        };
      const resolved = await dependencies.resolveIntegration(source);
      const url = new URL(resolved.url);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Unsupported integration URL");
      return { ...region, type: "integration", ...resolved };
    })
  );
  return { layout: { ...settings, renderId: randomUUID(), regions } };
}
