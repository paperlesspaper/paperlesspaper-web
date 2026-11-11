import { describe, expect, it, vi } from "vitest";
import {
  classifyIcons,
  compareIconColors,
  getMonochromeColor,
} from "../../src/components/Epaper/Integrations/ImageEditor/ArtBrowser/iconColors";
import type { Artwork } from "../../src/components/Epaper/Integrations/ImageEditor/ArtBrowser/types";

describe("icon colors", () => {
  it("recognizes single colors while ignoring transparent and antialiased edges", () => {
    expect(
      getMonochromeColor(
        new Uint8ClampedArray([
          255, 255, 255, 0, 10, 40, 90, 255, 12, 39, 89, 240, 0, 0, 0, 20,
        ]),
      ),
    ).toBe("#0a285a");
  });
  it("keeps multicolor, gradient and black-and-white icons out of the color tool", () => {
    for (const other of [
      [255, 255, 255],
      [25, 25, 25],
      [255, 0, 0],
    ]) {
      expect(
        getMonochromeColor(
          new Uint8ClampedArray([0, 0, 0, 255, ...other, 255]),
        ),
      ).toBeNull();
    }
  });
  it("does not classify an empty image as monochrome", () => {
    expect(getMonochromeColor(new Uint8ClampedArray(16))).toBeNull();
  });
  it("puts single-color icons last, including after more pages are appended", () => {
    const icon = (id: string, monochromeColor?: string) =>
      ({ id, source: "svgrepo", monochromeColor } as Artwork);
    const firstPage = [icon("colorful"), icon("mono", "#000000")];
    expect(
      [...firstPage, icon("colorful-page2"), icon("mono-page2", "#ff0000")]
        .sort(compareIconColors)
        .map(({ id }) => id),
    ).toEqual(["colorful", "colorful-page2", "mono", "mono-page2"]);
  });
});

it("returns a full result page within five seconds when icon image servers hang", async () => {
  vi.useFakeTimers();
  const created = vi.fn();
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        created();
      }
    },
  );
  try {
    const artworks = Array.from(
      { length: 120 },
      (_, id) =>
        ({
          id: String(id),
          source: "svgrepo",
          image: { url: `https://icons.example/hung/${id}.png` },
        } as Artwork),
    );
    let result: Artwork[] | undefined;
    void classifyIcons(artworks).then((items) => {
      result = items;
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(result).toHaveLength(120);
    expect(created).toHaveBeenCalledTimes(8);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
