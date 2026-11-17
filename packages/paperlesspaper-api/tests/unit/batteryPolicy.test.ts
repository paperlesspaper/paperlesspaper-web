import { describe, expect, it } from "vitest";
import { needsBatteryWarning } from "../../src/batteryNotifications/batteryPolicy.js";
import { getBatteryStatus } from "../../../paperlesspaper-web/src/helpers/devices/batteryStatus";
import { getBatteryMessage } from "../../src/batteryNotifications/batteryMessages.js";

const now = Date.parse("2026-11-17T12:00:00Z");
const recent = { lastReachableAgo: now - 3_600_000, sleepTime: "3600" };

describe("battery notification policy", () => {
  it.each([
    ["epd7", { ...recent, batLevel: "4299" }, true],
    ["openpaper13", { ...recent, batLevel: 4200 }, true],
    ["epd7", { ...recent, batLevel: 4300 }, false],
    ["epd7", { ...recent, batLevel: 6000 }, false],
    ["epd7", { ...recent, batLevel: 4200, usbConnected: true }, false],
    ["epd7", { ...recent, batLevel: 4200, chargerState: "charging" }, false],
    [
      "epd7",
      { ...recent, batLevel: 4200, lastReachableAgo: now - 7_200_001 },
      false,
    ],
    [
      "epd7",
      {
        ...recent,
        batLevel: 4200,
        lastReachableAgo: now - 86_400_000,
        nextDeviceSync: now + 3_600_000,
      },
      true,
    ],
    ["epd7", { batLevel: 4200 }, false],
    ["epd7", { ...recent, batLevel: "bad" }, false],
    ["epd7", { ...recent, batLevel: 0 }, false],
    ["epd7", { ...recent, batLevel: null }, false],
    ["epd7", { ...recent, batLevel: "" }, false],
    ["epd7", { ...recent, batLevel: -100 }, false],
    [
      "epd7",
      { batLevel: 4200, lastReachableAgo: (now - 3_600_000) / 1000 },
      true,
    ],
    [
      "epd7",
      { batLevel: 4200, lastReachableAgo: "2026-11-14T12:00:00Z" },
      false,
    ],
    ["epd7", null, false],
  ])("matches the web warning: %s %j", (kind, status, expected) => {
    expect(needsBatteryWarning(kind as string, status, now)).toBe(expected);
    expect(
      getBatteryStatus({
        currentDeviceClass: kind as string,
        deviceStatus: status as any,
        now,
      }).isBatteryLow
    ).toBe(expected);
  });
  it.each(["epaper", "memo", "anabox-smart", "unknown"])(
    "does not guess thresholds for %s",
    (kind) => {
      expect(
        needsBatteryWarning(kind, { ...recent, batLevel: 4200 }, now)
      ).toBe(false);
    }
  );
  it.each(["de", "en", "nl", "fr", "et", "se", "cz"])(
    "localizes the title, body and action in %s",
    (lng) => {
      const result = getBatteryMessage("Kitchen $&", lng);
      expect(result.title).toContain("Kitchen $&");
      expect(result.body).toContain("USB");
      expect(result.actionButtonText).toBeTruthy();
      if (lng !== "en")
        expect(result.body).not.toBe(getBatteryMessage("", "en").body);
    }
  );
  it("supports Auth0 and regional language codes, with English fallback", () => {
    expect(getBatteryMessage("A", "sv-SE")).toEqual(
      getBatteryMessage("A", "se")
    );
    expect(getBatteryMessage("A", "cs-CZ")).toEqual(
      getBatteryMessage("A", "cz")
    );
    expect(getBatteryMessage("A", "de-DE")).toEqual(
      getBatteryMessage("A", "de")
    );
    expect(getBatteryMessage("A", "unknown")).toEqual(
      getBatteryMessage("A", "en")
    );
  });
});
