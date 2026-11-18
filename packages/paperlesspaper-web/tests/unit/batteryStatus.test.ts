import { describe, expect, it } from "vitest";
import {
  getBatteryStatus,
  scaleBatteryRange,
} from "../../src/helpers/devices/batteryStatus";

const now = Date.parse("2026-11-17T10:00:00Z");
const recent = { lastReachableAgo: now - 60_000, batLevel: "5100" };
const status = (
  deviceStatus: Parameters<typeof getBatteryStatus>[0]["deviceStatus"],
  currentDeviceClass = "epd7"
) => getBatteryStatus({ currentDeviceClass, deviceStatus, now });

describe("battery telemetry", () => {
  it.each(["epd7", "openpaper13"])(
    "uses %s voltage limits for numeric and string readings",
    (kind) => {
      expect(status(recent, kind)).toMatchObject({
        levelScaled: 50,
        color: "green",
        batteryUnknown: false,
      });
      expect(status({ ...recent, batLevel: 4200 }, kind)).toMatchObject({
        color: "red",
      });
      expect(status({ ...recent, batLevel: 4200 }, kind).levelScaled).toBe(0);
    }
  );
  it.each([undefined, null, "", " ", "invalid", NaN, Infinity, 0, -1])(
    "treats invalid voltage %s as unknown",
    (batLevel) => {
      expect(status({ ...recent, batLevel })).toMatchObject({
        batteryUnknown: true,
        color: undefined,
      });
      expect(Number.isNaN(scaleBatteryRange({ value: batLevel }))).toBe(true);
    }
  );
  it.each([
    [4000, 0],
    [6000, 100],
    [6386, 100],
  ])("clamps %s mV to %s percent", (batLevel, levelScaled) => {
    expect(status({ ...recent, batLevel }).levelScaled).toBe(levelScaled);
  });
  it.each(["epd7", "openpaper13", "epaper"])(
    "recognizes explicit USB power for %s without requiring voltage",
    (kind) => {
      expect(
        status({ ...recent, batLevel: undefined, usbConnected: true }, kind)
          .isUsbConnected
      ).toBe(true);
      expect(
        status({ ...recent, usbConnected: false }, kind).isUsbConnected
      ).toBe(false);
      expect(status(recent, kind).isUsbConnected).toBe(false);
    }
  );
  it("preserves explicit charging and does not infer USB for unrelated kinds", () => {
    expect(
      status({ ...recent, chargerState: "charging" }, "memo").isCharging
    ).toBe(true);
    expect(
      status({ ...recent, usbConnected: true }, "memo").isUsbConnected
    ).toBe(false);
    expect(
      status({ ...recent, chargerState: "connected" }).isUsbConnected
    ).toBe(false);
  });
  it.each([null, undefined, "invalid"])(
    "does not display current state without a valid contact timestamp (%s)",
    (lastReachableAgo) => {
      expect(
        status({ ...recent, lastReachableAgo, usbConnected: true })
      ).toMatchObject({ batteryUnknown: true, isUsbConnected: false });
    }
  );
  it("accepts ISO, Unix seconds, and millisecond timestamps", () => {
    for (const lastReachableAgo of [
      new Date(now - 60_000).toISOString(),
      (now - 60_000) / 1000,
      String(now - 60_000),
    ]) {
      expect(status({ ...recent, lastReachableAgo }).batteryUnknown).toBe(
        false
      );
    }
  });
  it("marks missed hourly updates stale after one extra interval", () => {
    const telemetry = {
      batLevel: "5100",
      lastReachableAgo: now - 3 * 3600_000,
      nextDeviceSync: now - 2 * 3600_000,
      sleepTime: 3600,
      usbConnected: true,
    };
    expect(status(telemetry)).toMatchObject({
      isStale: true,
      batteryUnknown: true,
      isUsbConnected: false,
    });
  });
  it("allows at least 15 minutes grace for short wake intervals", () => {
    expect(
      status({
        ...recent,
        nextDeviceSync: now - 10 * 60_000,
        lastReachableAgo: now - 13 * 60_000,
        sleepTime: 180,
      }).isStale
    ).toBe(false);
  });
  it("respects a future scheduled wake instead of expiring overnight", () => {
    expect(
      status({
        ...recent,
        lastReachableAgo: now - 12 * 3600_000,
        nextDeviceSync: now + 3600_000,
        sleepTime: 180,
      }).isStale
    ).toBe(false);
  });
  it("falls back to the sleep interval or 48 hours when a next wake is missing", () => {
    expect(
      status({
        ...recent,
        lastReachableAgo: now - 3 * 3600_000,
        sleepTime: "3600",
      }).isStale
    ).toBe(true);
    expect(
      status({ ...recent, lastReachableAgo: now - 49 * 3600_000 }).isStale
    ).toBe(true);
    expect(
      status({ ...recent, lastReachableAgo: now - 47 * 3600_000 }).isStale
    ).toBe(false);
  });
  it("handles an absent status response", () => {
    expect(status(null)).toMatchObject({
      batteryUnknown: true,
      isUsbConnected: false,
      isStale: false,
    });
  });
});

it.each([4299, 4300, 4469, 4470, 4471, 4660])(
  "warns strictly below 15 percent at %s mV",
  (batLevel) => {
    const result = status({ ...recent, batLevel });
    expect(result.isBatteryLow).toBe(batLevel < 4470);
    expect(result.color === "red").toBe(batLevel < 4470);
  }
);
it("USB power suppresses low-battery warnings even with no batteries fitted", () => {
  expect(
    status({ ...recent, batLevel: "111", usbConnected: true })
  ).toMatchObject({ isUsbConnected: true, isBatteryLow: false });
});
it("does not treat a null USB report as charging", () => {
  expect(status({ ...recent, usbConnected: null }).isUsbConnected).toBe(false);
});

// Anonymized voltage/USB combinations from the read-only 30-device check.
// Contact times are synthetic: only fresh vs. stale is retained.
it("matches the approved 30-device preview without contacting production", () => {
  const samples = [
    ["epd7", 184, true, "usb", null],
    ["epd7", 4853, false, "offline", null],
    ["epd7", 111, true, "usb", null],
    ["epd7", 5116, false, "offline", null],
    ["epd7", 4491, false, "offline", null],
    ["epd7", 4560, false, "offline", null],
    ["epd7", 4579, false, "offline", null],
    ["epd7", 6588, false, "offline", null],
    ["epd7", 4160, false, "offline", null],
    ["epd7", 5254, false, "battery", 59],
    ["epd7", 147, true, "offline", null],
    ["openpaper13", 5096, false, "battery", 50],
    ["openpaper13", 5363, false, "battery", 65],
    ["openpaper13", 4963, false, "battery", 42],
    ["openpaper13", 5042, false, "battery", 47],
    ["openpaper13", 3701, true, "usb", null],
    ["epd7", 6050, false, "battery", 100],
    ["openpaper13", 6139, false, "battery", 100],
    ["epd7", 5751, false, "battery", 86],
    ["epd7", 5918, false, "battery", 95],
    ["epd7", 5947, false, "battery", 97],
    ["openpaper13", 5908, false, "battery", 95],
    ["epd7", 5026, false, "battery", 46],
    ["epd7", 5771, false, "battery", 87],
    ["epd7", 5779, false, "battery", 88],
    ["openpaper13", 3527, true, "usb", null],
    ["openpaper13", 5622, false, "battery", 79],
    ["openpaper13", 5213, false, "battery", 56],
    ["openpaper13", 6386, false, "battery", 100],
    ["epd7", 5439, false, "battery", 69],
  ] as const;
  const counts = { usb: 0, offline: 0, battery: 0, full: 0 };
  for (const [kind, batLevel, usbConnected, expected, percent] of samples) {
    const result = status(
      {
        batLevel: String(batLevel),
        usbConnected,
        sleepTime: 3600,
        lastReachableAgo:
          expected === "offline" ? now - 72 * 3600_000 : now - 60_000,
      },
      kind
    );
    const display = result.isStale
      ? "offline"
      : result.isUsbConnected
      ? "usb"
      : "battery";
    expect(display).toBe(expected);
    counts[display]++;
    if (display === "battery") {
      expect(Math.round(result.levelScaled)).toBe(percent);
      if (percent === 100) counts.full++;
    }
  }
  expect(counts).toEqual({ usb: 4, offline: 8, battery: 18, full: 3 });
});

it("does not describe USB power as battery charging, even if both flags are set", () => {
  expect(
    status({ ...recent, usbConnected: true, chargerState: "charging" })
  ).toMatchObject({ isUsbConnected: true, isCharging: false });
});
