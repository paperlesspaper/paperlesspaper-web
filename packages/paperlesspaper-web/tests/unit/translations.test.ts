// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { i18n as I18n } from "i18next";
import { applications } from "../../../helpers/src/epaper/applications";

import languages from "../../src/translation/languages";

let i18n: I18n;
beforeAll(async () => {
  vi.stubEnv("MODE", "production");
  localStorage.setItem("i18nextLng", "nl-BE");
  i18n = (await import("../../src/translation/i18n")).default;
});
afterAll(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe("bundled interface translations", () => {
  it("detects regional Dutch and translates the reported labels", () => {
    expect(i18n.resolvedLanguage).toBe("nl");
    expect(i18n.t("Select application")).toBe("Selecteer applicatie");
    expect(i18n.t("Next Image")).toBe("Volgende afbeelding");
    expect(i18n.t("Community Plugins")).toBe("Communityplug-ins");
    expect(i18n.t("Next sync in {{nextSync}}.", { nextSync: "5s" })).toBe(
      "Volgende synchronisatie over 5s."
    );
  });

  it("provides Dutch names and descriptions for every built-in integration", () => {
    for (const app of applications) {
      for (const key of [app.name, app.description]) {
        expect(i18n.getResource("nl", "pwa", key), key).toBeTruthy();
      }
    }
  });

  it("provides the next image label in every supported language", () => {
    for (const locale of ["en", "de", "nl", "fr", "et", "se", "cz"]) {
      expect(
        i18n.getResource(locale, "pwa", "Next Image"),
        locale
      ).toBeTruthy();
    }
  });

  it("bundles the USB connection label in every supported language and namespace", () => {
    const expected = {
      de: "über USB verbunden",
      en: "Connected via USB",
      nl: "verbonden via USB",
      fr: "Connecté via USB",
      et: "USB kaudu ühendatud",
      se: "Ansluten via USB",
      cz: "Připojeno přes USB",
    };
    expect(Object.keys(expected).sort()).toEqual(Object.keys(languages).sort());
    for (const [lng, label] of Object.entries(expected)) {
      for (const ns of ["pwa", "plp-pwa"]) {
        expect(i18n.getResource(lng, ns, "Connected via USB")).toBe(label);
        expect(
          i18n.t("Connected via USB", { lng, ns, fallbackLng: false })
        ).toBe(label);
      }
    }
  });

  it("uses English for unsupported languages and missing or empty entries", async () => {
    i18n.addResource("en", "pwa", "TEST_FALLBACK", "English fallback");
    i18n.addResource("nl", "pwa", "TEST_FALLBACK", "");
    await i18n.changeLanguage("nl");
    expect(i18n.t("TEST_FALLBACK")).toBe("English fallback");
    await i18n.changeLanguage("es");
    expect(i18n.resolvedLanguage).toBe("en");
    expect(i18n.t("TEST_FALLBACK")).toBe("English fallback");
  });
});

it("bundles battery notification settings in every supported language and namespace", () => {
  const keys = [
    "Low battery notifications",
    "Get notified when your device's batteries are running low. Checked every four hours; reminders at most every 48 hours.",
    "Enabling push alerts also enables notifications on this device.",
    "Enabling push notifications…",
    "Push notifications could not be enabled on this device. Check your notification permissions and try again.",
    "Loading notification settings…",
    "Notification settings could not be loaded.",
    "Notification settings could not be saved. Please try again.",
    "Notification settings saved.",
    "Save notification settings",
    "Saving…",
    "Retry",
    "Email",
    "Push notifications",
    "Please replace the batteries or connect the device via USB.",
  ];
  for (const lng of Object.keys(languages))
    for (const ns of ["pwa", "plp-pwa"])
      for (const key of keys)
        expect(
          i18n.getResource(lng, ns, key),
          `${lng}/${ns}/${key}`
        ).toBeTruthy();
});
