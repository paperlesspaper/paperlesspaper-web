import { describe, expect, it } from "vitest";
import {
  containFrame,
  deriveDeviceImageSyncState,
  deriveDeviceSyncDisplayState,
  isHttpUrl,
  mergeUrlWithQueryParams,
  normalizeTimestamp,
  normalizeFrameFinish,
  PRIMARY_FRAME_DECORATION,
  toValidDate,
} from "../../src/components/Epaper/Overview/photoFrameModel";

describe("normalizeFrameFinish", () => {
  it("keeps supported finishes and defaults invalid values to black", () => {
    expect(normalizeFrameFinish("black")).toBe("black");
    expect(normalizeFrameFinish("white")).toBe("white");
    expect(normalizeFrameFinish("walnut")).toBe("black");
    expect(normalizeFrameFinish(undefined)).toBe("black");
  });
});

describe("normalizeTimestamp", () => {
  it("normalizes seconds, milliseconds, and ISO date strings", () => {
    expect(normalizeTimestamp(1_700_000_000)).toBe(1_700_000_000_000);
    expect(normalizeTimestamp("1700000000000")).toBe(1_700_000_000_000);
    expect(normalizeTimestamp("2026-08-10T12:00:00.000Z")).toBe(
      1_786_363_200_000
    );
  });

  it("rejects missing and invalid timestamps", () => {
    expect(normalizeTimestamp(undefined)).toBeNull();
    expect(normalizeTimestamp("")).toBeNull();
    expect(toValidDate("not-a-date")).toBeNull();
  });
});

describe("plugin preview URLs", () => {
  it("merges settings without dropping an existing query or hash", () => {
    expect(
      mergeUrlWithQueryParams("https://example.com/view?theme=dark#preview", {
        calendar: "family",
      })
    ).toBe("https://example.com/view?theme=dark&calendar=family#preview");
  });

  it("recognizes only absolute HTTP URLs", () => {
    expect(isHttpUrl("https://example.com/view")).toBe(true);
    expect(isHttpUrl("http://localhost:3000/view")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("/relative/view")).toBe(false);
  });
});

describe("deriveDeviceImageSyncState", () => {
  it("only treats the image as current when the device reached its version", () => {
    expect(
      deriveDeviceImageSyncState({
        pictureSynced: true,
        fileVersion: 200,
        lastReachableAgo: 100,
      })
    ).toEqual({
      latestImageIsOnDevice: false,
      latestImageSyncIsPending: true,
    });

    expect(
      deriveDeviceImageSyncState({
        pictureSynced: true,
        fileVersion: 200,
        lastReachableAgo: 200,
      })
    ).toEqual({
      latestImageIsOnDevice: true,
      latestImageSyncIsPending: false,
    });
  });
});

describe("deriveDeviceSyncDisplayState", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  it.each([
    [null, false, "trying"],
    [new Date("2026-08-10T11:59:30.000Z"), false, "updating"],
    [new Date("2026-08-10T11:58:00.000Z"), false, "offline"],
    [new Date("2026-08-10T12:05:00.000Z"), true, "current"],
    [new Date("2026-08-10T12:05:00.000Z"), false, "pending"],
  ] as const)(
    "returns %s for next sync %s",
    (nextDeviceSync, latestImageIsOnDevice, expected) => {
      expect(
        deriveDeviceSyncDisplayState({
          latestImageIsOnDevice,
          nextDeviceSync,
          now,
        })
      ).toBe(expected);
    }
  );
});

describe("containFrame", () => {
  it("fits a landscape display by width without changing its ratio", () => {
    const layout = containFrame(
      { width: 900, height: 900 },
      { width: 800, height: 480 },
      PRIMARY_FRAME_DECORATION
    );

    expect(layout.frame.width).toBeCloseTo(900);
    expect(layout.frame.height).toBeLessThanOrEqual(900);
    expect(layout.viewport.width / layout.viewport.height).toBeCloseTo(
      800 / 480
    );
  });

  it("fits a portrait display by height without changing its ratio", () => {
    const layout = containFrame(
      { width: 900, height: 600 },
      { width: 480, height: 800 },
      PRIMARY_FRAME_DECORATION
    );

    expect(layout.frame.width).toBeLessThanOrEqual(900);
    expect(layout.frame.height).toBeCloseTo(600);
    expect(layout.viewport.width / layout.viewport.height).toBeCloseTo(
      480 / 800
    );
  });

  it("uses width when the container has automatic height", () => {
    const layout = containFrame(
      { width: 500, height: 0 },
      { width: 800, height: 480 },
      PRIMARY_FRAME_DECORATION
    );

    expect(layout.frame.width).toBeCloseTo(500);
    expect(layout.frame.height).toBeGreaterThan(0);
  });

  it("scales the frame and mat padding with the rendered frame", () => {
    const small = containFrame(
      { width: 900, height: 900 },
      { width: 800, height: 480 },
      PRIMARY_FRAME_DECORATION
    );
    const large = containFrame(
      { width: 1800, height: 1800 },
      { width: 800, height: 480 },
      PRIMARY_FRAME_DECORATION
    );

    const smallFrameShortEdge = Math.min(small.frame.width, small.frame.height);

    expect(small.decoration.framePadding / smallFrameShortEdge).toBeCloseTo(
      PRIMARY_FRAME_DECORATION.framePaddingRatio
    );
    expect(small.decoration.matPadding / smallFrameShortEdge).toBeCloseTo(
      PRIMARY_FRAME_DECORATION.matPaddingRatio
    );
    expect(large.decoration.framePadding).toBe(
      small.decoration.framePadding * 2
    );
    expect(large.decoration.matPadding).toBe(small.decoration.matPadding * 2);
  });
});
