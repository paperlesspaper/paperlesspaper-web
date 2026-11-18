import { describe, expect, it } from "vitest";
import { getBatteryWarning } from "../../src/batteryNotifications/batteryPolicy.js";
import { getBatteryStatus } from "../../../paperlesspaper-web/src/helpers/devices/batteryStatus";
import { getBatteryMessage } from "../../src/batteryNotifications/batteryMessages.js";

const now = Date.parse("2026-11-17T12:00:00Z");
const day = 86_400_000;
const recent = { lastReachableAgo: now - 3_600_000, sleepTime: "3600" };

describe("battery notification policy", () => {
  it.each([
    [{ ...recent, batLevel: "4469" }, "low"],
    [{ ...recent, batLevel: 4470 }, null],
    [{ ...recent, batLevel: 4471 }, null],
    [{ ...recent, batLevel: 4300 }, "low"],
    [{ ...recent, batLevel: 4200 }, "low"],
    [{ ...recent, batLevel: 6000 }, null],
    [{ ...recent, batLevel: 4200, usbConnected: true }, null],
    [{ ...recent, batLevel: 4200, chargerState: "charging" }, null],
    [{ ...recent, batLevel: 4200, lastReachableAgo: now - 7_200_001 }, null],
    [{ batLevel: 4200 }, null],
    [{ ...recent, batLevel: "bad" }, null],
    [{ ...recent, batLevel: 0 }, null],
    [{ ...recent, batLevel: null }, null],
    [{ ...recent, batLevel: "" }, null],
    [{ ...recent, batLevel: -100 }, null],
    [{ batLevel: 4200, lastReachableAgo: (now - 3_600_000) / 1000 }, "low"],
    [null, null],
  ])(
    "matches the web's strictly below 15%% warning: %j",
    (status, expected) => {
      for (const kind of ["epd7", "openpaper13"]) {
        expect(getBatteryWarning(kind, status, now)).toBe(expected);
        expect(
          getBatteryStatus({
            currentDeviceClass: kind,
            deviceStatus: status as any,
            now,
          }).isBatteryLow
        ).toBe(expected === "low");
      }
    }
  );
  it.each([
    [{ lastReachableAgo: now - day + 1 }, null],
    [{ lastReachableAgo: now - day }, null],
    [{ lastReachableAgo: now - day - 1 }, "empty"],
    [{ lastReachableAgo: (now - day - 1000) / 1000 }, "empty"],
    [{ lastReachableAgo: new Date(now - day - 1).toISOString() }, "empty"],
    [
      { lastReachableAgo: now - day - 1, usbConnected: true, batLevel: 6000 },
      "empty",
    ],
    [{ lastReachableAgo: now - day - 1, chargerState: "charging" }, "empty"],
    [
      {
        lastReachableAgo: now - day - 1,
        nextDeviceSync: now + day,
        sleepTime: 7 * 86400,
      },
      "empty",
    ],
    [{ lastReachableAgo: now - day - 1, batLevel: 4200 }, "empty"],
    [{ lastReachableAgo: "invalid", batLevel: 4200 }, null],
    [{ lastReachableAgo: null, batLevel: 4200 }, null],
    [{ lastReachableAgo: 0, batLevel: 4200 }, null],
    [{ lastReachableAgo: now + 1000, batLevel: 4200 }, null],
  ])(
    "uses last contact strictly over 24 hours for the empty warning: %j",
    (status, expected) => {
      expect(getBatteryWarning("epd7", status, now)).toBe(expected);
    }
  );
  it.each(["epaper", "memo", "anabox-smart", "unknown"])(
    "does not guess battery warnings for %s",
    (kind) => {
      expect(
        getBatteryWarning(kind, { ...recent, batLevel: 4200 }, now)
      ).toBeNull();
      expect(
        getBatteryWarning(kind, { lastReachableAgo: now - 2 * day }, now)
      ).toBeNull();
    }
  );
  it.each(["de", "en", "nl", "fr", "et", "se", "cz"])(
    "localizes both warning titles and bodies in %s",
    (lng) => {
      for (const warning of ["low", "empty"] as const) {
        const result = getBatteryMessage("Kitchen $&", lng, warning);
        expect(result.title).toContain("Kitchen $&");
        expect(result.actionButtonText).toBeTruthy();
        if (lng !== "en")
          expect(result.body).not.toBe(
            getBatteryMessage("", "en", warning).body
          );
      }
      expect(getBatteryMessage("", lng, "empty").body).not.toBe(
        getBatteryMessage("", lng, "low").body
      );
    }
  );
  it("supports Auth0 and regional language codes, with English fallback", () => {
    for (const warning of ["low", "empty"] as const) {
      expect(getBatteryMessage("A", "sv-SE", warning)).toEqual(
        getBatteryMessage("A", "se", warning)
      );
      expect(getBatteryMessage("A", "cs-CZ", warning)).toEqual(
        getBatteryMessage("A", "cz", warning)
      );
      expect(getBatteryMessage("A", "de-DE", warning)).toEqual(
        getBatteryMessage("A", "de", warning)
      );
      expect(getBatteryMessage("A", "unknown", warning)).toEqual(
        getBatteryMessage("A", "en", warning)
      );
    }
  });
});
