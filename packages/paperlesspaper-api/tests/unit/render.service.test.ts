import { afterEach, describe, expect, it } from "vitest";
import {
  getBrowserLaunchOptions,
  getRenderInitPayload,
} from "../../src/render/render.service";

const originalChromeBin = process.env.CHROME_BIN;

const restoreChromeBin = () => {
  if (originalChromeBin === undefined) {
    delete process.env.CHROME_BIN;
    return;
  }

  process.env.CHROME_BIN = originalChromeBin;
};

describe("render.service browser launch options", () => {
  afterEach(() => {
    restoreChromeBin();
  });

  it("uses the configured headless shell executable", () => {
    process.env.CHROME_BIN = "/usr/bin/chromium-headless-shell";

    const options = getBrowserLaunchOptions();

    expect(options).toMatchObject({
      executablePath: "/usr/bin/chromium-headless-shell",
      headless: "shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });
});

describe("render.service INIT payload", () => {
  it("sends the OpenIntegration render payload for plugin papers", () => {
    const payload = {
      settings: { headline: "Configured headline" },
      nativeSettings: { orientation: "portrait" },
    };
    const paper = {
      kind: "plugin",
      meta: {
        pluginSettings: { headline: "Configured headline" },
      },
    };

    expect(getRenderInitPayload({ data: payload, paper })).toBe(payload);
  });

  it("keeps the legacy paper document INIT payload for non-plugin papers", () => {
    const payload = { calendarData: [] };
    const paper = {
      kind: "google-calendar",
      meta: { dayRange: 7 },
    };

    expect(getRenderInitPayload({ data: payload, paper })).toBe(paper);
  });
});
