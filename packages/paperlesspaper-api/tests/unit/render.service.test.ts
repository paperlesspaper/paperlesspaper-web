import { afterEach, describe, expect, it } from "vitest";
import { getBrowserLaunchPlans } from "../../src/render/render.service";

const originalChromeBin = process.env.CHROME_BIN;
const originalHeadlessShellBin = process.env.CHROME_HEADLESS_SHELL_BIN;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

describe("render.service browser launch plans", () => {
  afterEach(() => {
    restoreEnv("CHROME_BIN", originalChromeBin);
    restoreEnv("CHROME_HEADLESS_SHELL_BIN", originalHeadlessShellBin);
  });

  it("adds a headless shell fallback when the runtime image provides one", () => {
    process.env.CHROME_BIN = "/usr/bin/chromium";
    process.env.CHROME_HEADLESS_SHELL_BIN = "/usr/bin/chromium-headless-shell";

    const plans = getBrowserLaunchPlans();

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      label: "chromium",
      options: {
        executablePath: "/usr/bin/chromium",
        headless: true,
      },
    });
    expect(plans[1]).toMatchObject({
      label: "chromium-headless-shell",
      options: {
        executablePath: "/usr/bin/chromium-headless-shell",
        headless: "shell",
      },
    });
    expect(plans[1].options.args).toEqual(
      expect.arrayContaining([
        "--no-sandbox",
        "--disable-crashpad",
        "--disable-dev-shm-usage",
        "--no-zygote",
      ]),
    );
  });

  it("keeps a single launch plan when no fallback binary is configured", () => {
    process.env.CHROME_BIN = "/usr/bin/chromium";
    delete process.env.CHROME_HEADLESS_SHELL_BIN;

    expect(getBrowserLaunchPlans()).toHaveLength(1);
  });
});
