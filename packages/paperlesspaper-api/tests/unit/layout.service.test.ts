import { describe, expect, it, vi } from "vitest";
import {
  layoutSettingsSchema,
  layoutPreviewQuerySchema,
  resolveLayoutPayload,
} from "../../src/papers/layout.service";
const organization = "aaaaaaaaaaaaaaaaaaaaaaaa";
const photo = "bbbbbbbbbbbbbbbbbbbbbbbb";
const calendar = "cccccccccccccccccccccccc";
const paper = {
  organization,
  meta: {
    regions: [
      { id: "photo", paperId: photo },
      { id: "calendar", paperId: calendar },
    ],
  },
};
function dependencies() {
  return {
    loadPaper: vi.fn(async (id: string) => ({
      _id: id,
      organization,
      kind: id === photo ? "image" : "plugin",
    })),
    imageUrl: vi.fn(async () => "https://images.example/signed-original.png"),
    resolveIntegration: vi.fn(async () => ({
      url: "https://integrations.example/calendar",
      payload: { calendarData: { events: [] } },
    })),
  };
}
describe("layout source resolution", () => {
  it("rejects deviceId query parameters before organization membership is checked", () => {
    expect(() => layoutPreviewQuerySchema.parse({ organization, deviceId: photo })).toThrow();
    expect(layoutPreviewQuerySchema.parse({ organization })).toEqual({ organization });
  });
  it("resolves an original image and an integration into a fresh render generation", async () => {
    const deps = dependencies();
    const first = await resolveLayoutPayload(paper, deps);
    const second = await resolveLayoutPayload(paper, deps);
    expect(first.layout.renderId).not.toBe(second.layout.renderId);
    expect(first.layout.regions).toMatchObject([
      { type: "image", url: "https://images.example/signed-original.png" },
      { type: "integration", payload: { calendarData: { events: [] } } },
    ]);
    expect(deps.loadPaper).toHaveBeenCalledWith(photo, organization);
  });
  it.each([null, { organization: "dddddddddddddddddddddddd", kind: "image" }])(
    "does not sign or fetch anything when a reference is unavailable: %s",
    async (source) => {
      const deps = dependencies();
      deps.loadPaper.mockResolvedValueOnce(source as any);
      await expect(resolveLayoutPayload(paper, deps)).rejects.toThrow(
        "unavailable"
      );
      expect(deps.imageUrl).not.toHaveBeenCalled();
      expect(deps.resolveIntegration).not.toHaveBeenCalled();
    }
  );
  it.each(["layout", "slides", "playlist", "printer"])(
    "rejects unsupported/nested %s sources",
    async (kind) => {
      const deps = dependencies();
      deps.loadPaper.mockResolvedValueOnce({ _id: photo, organization, kind });
      await expect(resolveLayoutPayload(paper, deps)).rejects.toThrow(
        "cannot contain"
      );
    }
  );
  it("rejects duplicate slot names and more than four slots", () => {
    expect(() =>
      layoutSettingsSchema.parse({
        regions: [paper.meta.regions[0], paper.meta.regions[0]],
      })
    ).toThrow();
    expect(() =>
      layoutSettingsSchema.parse({
        regions: Array(5).fill(paper.meta.regions[0]),
      })
    ).toThrow();
  });
});
