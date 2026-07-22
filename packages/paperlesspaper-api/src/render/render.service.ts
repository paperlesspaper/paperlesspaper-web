import puppeteer from "puppeteer";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  aitjcizeSpectra6Palette,
  ditherImage as optimizeCanvas,
  replaceColors,
  suggestCanvasProcessingOptions,
} from "epdoptimize";
import type {
  AutoProcessingIntent,
  DitherImageOptions as EpdDitherImageOptions,
  PaletteColorEntry,
} from "epdoptimize";
import { deviceByKind } from "@paperlesspaper/helpers";
import { adBlock } from "./adBlock.service";
import {
  EPD_OPTIMIZE_META_NAME,
  parseEpdOptimizeMetaContent,
  resolveEpdOptimizePalette,
} from "./epdOptimizeMeta";
import type { EpdOptimizeMetaSettings } from "./epdOptimizeMeta";

import type { Browser, LaunchOptions, Page } from "puppeteer";

type GenerateImageOptions = {
  token?: string;
  scroll?: number;
  url: string;
  orientation?: "portrait" | "landscape";
  data?: any;
  css?: string;
  kind: string;
  paper?: any;
  timezone?: string;
};

export type PuppeteerRenderDiagnostics = {
  renderer: "puppeteer";
  outcome: "success" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  url: string;
  viewport: {
    width: number;
    height: number;
    orientation: "portrait" | "landscape";
    kind: string;
  };
  initPayloadSent: boolean;
  legacyDataPayloadSent: boolean;
  networkIdle: {
    outcome: "idle" | "timeout-or-error" | "not-checked";
    error?: { name?: string; message: string };
  };
  readiness: {
    outcome: "website-has-loaded" | "timeout" | "legacy-delay" | "not-checked";
    protocolDetected: boolean;
    loadingElementDetectedBeforeInit: boolean;
    loadedElementDetectedBeforeInit: boolean;
    loadingElementDetectedAfterInit: boolean;
    loadedElementDetectedAfterInit: boolean;
    websiteHasLoadedDetected: boolean | null;
    selector: "#website-has-loaded";
    timeoutMs: number;
    waitDurationMs: number;
    error?: { name?: string; message: string };
  };
  pageState: {
    status: "ready" | "error" | "loading" | "unknown";
    hasErrorElement: boolean;
    errorText?: string;
  };
  timings: Record<string, number>;
  error?: { name?: string; message: string };
};

type RenderDitherImageOptions = {
  buffer: Buffer;
  size?: { width: number; height: number; name?: string; frameKind?: string };
  palette?: PaletteColorEntry[];
  intent?: AutoProcessingIntent;
  options?: Partial<EpdDitherImageOptions>;
  epdOptimizeSettings?: EpdOptimizeMetaSettings;
};

type RenderResizeImageOptions = {
  buffer: Buffer;
  size: { width: number; height: number; name: string; frameKind?: string };
};

type Orientation = "portrait" | "landscape";

type DeviceSize = {
  width: number;
  height: number;
  name: Orientation;
  frameKind: string;
};

type BrowserViewportSize = DeviceSize & {
  value: number;
};

type ResizeImageToDeviceSizeOptions = {
  buffer: Buffer;
  kind: string;
  orientation?: Orientation;
};

export const getRenderInitPayload = ({
  data,
  paper,
}: Pick<GenerateImageOptions, "data" | "paper">) => {
  if (paper?.kind === "plugin" && data) {
    return data;
  }

  return paper;
};

export const emulatePageTimezone = async (
  page: Pick<Page, "emulateTimezone">,
  timezone?: string,
): Promise<void> => {
  if (timezone) {
    await page.emulateTimezone(timezone);
  }
};

const OPENPAPER7_FALLBACK_SIZE = {
  width: 800,
  height: 480,
};

const READINESS_SELECTOR = "#website-has-loaded" as const;
const READINESS_TIMEOUT_MS = 15_000;
const LEGACY_RENDER_DELAY_MS = 5_000;

const serializeRenderError = (
  error: unknown,
): { name?: string; message: string } => ({
  name: error instanceof Error ? error.name : undefined,
  message: error instanceof Error ? error.message : String(error),
});

const sanitizeRenderUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(value || "").split(/[?#]/, 1)[0];
  }
};

const resolveDeviceResolution = (
  kind?: string,
): { width: number; height: number } => {
  const requested = kind ? deviceByKind(kind) : null;
  const fallback = deviceByKind("epd7");

  const width =
    requested?.resolution?.width ||
    fallback?.resolution?.width ||
    OPENPAPER7_FALLBACK_SIZE.width;
  const height =
    requested?.resolution?.height ||
    fallback?.resolution?.height ||
    OPENPAPER7_FALLBACK_SIZE.height;

  return { width, height };
};

let sharedBrowser: Browser | null = null;
let sharedBrowserPromise: Promise<Browser> | null = null;

const browserLaunchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];

export const getBrowserLaunchOptions = (): LaunchOptions => ({
  executablePath: process.env.CHROME_BIN,
  headless: "shell",
  args: browserLaunchArgs,
});

const launchSharedBrowser = async (): Promise<Browser> => {
  const browser = await puppeteer.launch(getBrowserLaunchOptions());

  browser.on("disconnected", () => {
    sharedBrowser = null;
    sharedBrowserPromise = null;
  });

  sharedBrowser = browser;
  return browser;
};

const getBrowser = async (): Promise<Browser> => {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchSharedBrowser().catch((error) => {
      sharedBrowserPromise = null;
      throw error;
    });
  }

  return sharedBrowserPromise;
};

const generateImageFromUrl = async ({
  token,
  scroll = 0,
  url,
  orientation = "portrait",
  data,
  paper,
  css,
  kind = "epd7",
  timezone,
}: GenerateImageOptions): Promise<{
  buffer: Buffer | null;
  size: DeviceSize;
  diagnostics: PuppeteerRenderDiagnostics;
  epdOptimizeSettings?: EpdOptimizeMetaSettings;
}> => {
  const { width: initWidth, height: initHeight } =
    resolveDeviceResolution(kind);

  const rotationList: Record<Orientation, BrowserViewportSize> = {
    portrait: {
      name: "portrait",
      value: 9,
      width: initHeight,
      height: initWidth,
      frameKind: kind,
    },
    landscape: {
      name: "landscape",
      value: 0,
      width: initWidth,
      height: initHeight,
      frameKind: kind,
    },
  };

  const size = rotationList[orientation];

  let page: Page | null = null;

  const appsBaseUrl =
    process.env.PAPERLESSPAPER_APPS_URL || "https://apps.paperlesspaper.de";
  const requestedUrl = String(url || "");
  const urlLocal =
    appsBaseUrl === "https://apps.paperlesspaper.de"
      ? requestedUrl
      : requestedUrl.replace("https://apps.paperlesspaper.de", appsBaseUrl);

  const renderStartedAt = new Date();
  const timings: Record<string, number> = {};
  let initPayloadSent = false;
  let legacyDataPayloadSent = false;
  let networkIdle: PuppeteerRenderDiagnostics["networkIdle"] = {
    outcome: "not-checked",
  };
  let readiness: PuppeteerRenderDiagnostics["readiness"] = {
    outcome: "not-checked",
    protocolDetected: false,
    loadingElementDetectedBeforeInit: false,
    loadedElementDetectedBeforeInit: false,
    loadingElementDetectedAfterInit: false,
    loadedElementDetectedAfterInit: false,
    websiteHasLoadedDetected: null,
    selector: READINESS_SELECTOR,
    timeoutMs: READINESS_TIMEOUT_MS,
    waitDurationMs: 0,
  };
  let pageState: PuppeteerRenderDiagnostics["pageState"] = {
    status: "unknown",
    hasErrorElement: false,
  };
  let epdOptimizeSettings: EpdOptimizeMetaSettings | undefined;

  const measure = async <T>(
    name: string,
    action: () => Promise<T>,
  ): Promise<T> => {
    const startedAt = Date.now();
    try {
      return await action();
    } finally {
      timings[name] = Date.now() - startedAt;
    }
  };

  const finishDiagnostics = (
    outcome: PuppeteerRenderDiagnostics["outcome"],
    error?: unknown,
  ): PuppeteerRenderDiagnostics => {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - renderStartedAt.getTime();
    return {
      renderer: "puppeteer",
      outcome,
      startedAt: renderStartedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      url: sanitizeRenderUrl(urlLocal),
      viewport: {
        width: size.width,
        height: size.height,
        orientation: size.name,
        kind,
      },
      initPayloadSent,
      legacyDataPayloadSent,
      networkIdle,
      readiness,
      pageState,
      timings: { ...timings, totalMs: durationMs },
      ...(error ? { error: serializeRenderError(error) } : {}),
    };
  };

  try {
    const browser = await measure("browserMs", () => getBrowser());
    //console.log('Navigating to URL:', urlLocal);
    //const context = await browser.createIncognitoBrowserContext();
    //page = await context.newPage();

    page = await measure("pageCreationMs", () => browser.newPage());
    if (timezone) {
      await measure("timezoneMs", () => emulatePageTimezone(page!, timezone));
    }
    await measure("viewportMs", () =>
      page!.setViewport({
        width: size.width,
        height: size.height,
        deviceScaleFactor: 1,
      }),
    );

    await measure("navigationMs", () =>
      page!.goto(urlLocal, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      }),
    );
    await measure("adBlockMs", () => adBlock(page!));
    //console.log('AdBlock applied');

    const readReadinessMarkers = () =>
      page!.evaluate(() => ({
        loading: Boolean(
          document.querySelector("#website-has-loading-element"),
        ),
        loaded: Boolean(document.querySelector("#website-has-loaded")),
      }));

    let markersBeforeInit = await measure(
      "markerCheckBeforeInitMs",
      readReadinessMarkers,
    );
    const pluginReadinessProtocolDetectedAtDomReady =
      paper?.kind === "plugin" &&
      (markersBeforeInit.loading || markersBeforeInit.loaded);

    if (pluginReadinessProtocolDetectedAtDomReady) {
      timings.networkIdleMs = 0;
      timings.preInitDelayMs = 0;
    } else {
      const networkIdleStartedAt = Date.now();
      try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
        networkIdle = { outcome: "idle" };
      } catch (error) {
        networkIdle = {
          outcome: "timeout-or-error",
          error: serializeRenderError(error),
        };
      } finally {
        timings.networkIdleMs = Date.now() - networkIdleStartedAt;
      }

      await measure(
        "preInitDelayMs",
        () => new Promise((resolve) => setTimeout(resolve, 500)),
      );
      markersBeforeInit = await measure(
        "markerRecheckBeforeInitMs",
        readReadinessMarkers,
      );
    }

    //console.log('Checking for loading element:', loadingElementExists);

    if (data && paper?.kind !== "plugin") {
      await measure("legacyDataDispatchMs", () =>
        page!.evaluate((payload) => {
          window.postMessage(
            { cmd: "message", data: payload, type: "GOOGLECALENDAR" },
            "*",
          );
        }, data),
      );
      legacyDataPayloadSent = true;
    }

    console.log("Data posted to page, waiting for content to render...", paper);
    const initPayload = getRenderInitPayload({ data, paper });
    if (initPayload) {
      await measure("initDispatchMs", () =>
        page!.evaluate((payload) => {
          window.postMessage(
            { cmd: "message", data: payload, type: "INIT" },
            "*",
          );
        }, initPayload),
      );
      initPayloadSent = true;
    }

    const markersAfterInit = await measure("markerCheckAfterInitMs", () =>
      page!.evaluate(() => ({
        loading: Boolean(
          document.querySelector("#website-has-loading-element"),
        ),
        loaded: Boolean(document.querySelector("#website-has-loaded")),
      })),
    );
    const readinessProtocolDetected =
      markersBeforeInit.loading ||
      markersBeforeInit.loaded ||
      markersAfterInit.loading ||
      markersAfterInit.loaded;

    readiness = {
      ...readiness,
      protocolDetected: readinessProtocolDetected,
      loadingElementDetectedBeforeInit: markersBeforeInit.loading,
      loadedElementDetectedBeforeInit: markersBeforeInit.loaded,
      loadingElementDetectedAfterInit: markersAfterInit.loading,
      loadedElementDetectedAfterInit: markersAfterInit.loaded,
    };

    if (readinessProtocolDetected) {
      const readinessStartedAt = Date.now();
      try {
        await page.waitForSelector(READINESS_SELECTOR, {
          timeout: READINESS_TIMEOUT_MS,
        });
        readiness = {
          ...readiness,
          outcome: "website-has-loaded",
          websiteHasLoadedDetected: true,
        };
      } catch (error) {
        readiness = {
          ...readiness,
          outcome: "timeout",
          websiteHasLoadedDetected: false,
          error: serializeRenderError(error),
        };
      } finally {
        const waitDurationMs = Date.now() - readinessStartedAt;
        timings.readinessWaitMs = waitDurationMs;
        readiness.waitDurationMs = waitDurationMs;
      }
    } else {
      const legacyStartedAt = Date.now();
      await new Promise((resolve) =>
        setTimeout(resolve, LEGACY_RENDER_DELAY_MS),
      );
      const waitDurationMs = Date.now() - legacyStartedAt;
      timings.readinessWaitMs = waitDurationMs;
      readiness = {
        ...readiness,
        outcome: "legacy-delay",
        waitDurationMs,
      };
    }

    pageState = (await measure("pageStateCheckMs", () =>
      page!.evaluate(() => {
        const reportedStatus =
          document.documentElement.dataset.paperlessRenderStatus;
        const errorElement = document.querySelector(
          ".pp-error, [role='alert']",
        );
        const status =
          reportedStatus === "ready" ||
          reportedStatus === "error" ||
          reportedStatus === "loading"
            ? reportedStatus
            : errorElement
              ? "error"
              : document.querySelector("#website-has-loaded")
                ? "ready"
                : document.querySelector("#website-has-loading-element")
                  ? "loading"
                  : "unknown";
        const errorText =
          document.documentElement.dataset.paperlessRenderError ||
          errorElement?.textContent?.trim() ||
          undefined;

        return {
          status,
          hasErrorElement: Boolean(errorElement),
          ...(errorText ? { errorText: errorText.slice(0, 2_000) } : {}),
        };
      }),
    )) as PuppeteerRenderDiagnostics["pageState"];

    //console.log('render finished:', scroll);
    if (css) {
      await measure("customCssMs", () =>
        page!.addStyleTag({
          content: `${css}`,
        }),
      );
    }

    epdOptimizeSettings = await measure("epdOptimizeMetaMs", async () => {
      const content = await page!.evaluate(
        (metaName) =>
          document
            .querySelector(`meta[name="${metaName}"]`)
            ?.getAttribute("content"),
        EPD_OPTIMIZE_META_NAME,
      );

      return parseEpdOptimizeMetaContent(content);
    });

    const screenshot = await measure("screenshotMs", () => page!.screenshot());
    const buffer = Buffer.from(screenshot);

    if (token) {
      await page.evaluate(() => {
        localStorage.setItem("print-token", "");
      });
    }
    return {
      buffer,
      size,
      diagnostics: finishDiagnostics("success"),
      epdOptimizeSettings,
    };
  } catch (error) {
    console.error("Render error:", {
      url,
      urlLocal,
      appsBaseUrl,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      buffer: null,
      size,
      diagnostics: finishDiagnostics("error", error),
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        //console.log('Page close error:', closeError);
      }
    }
  }
};

const getDeviceSize = ({
  kind,
  orientation = "portrait",
}: {
  kind: string;
  orientation?: Orientation;
}): DeviceSize => {
  const { width: initWidth, height: initHeight } =
    resolveDeviceResolution(kind);

  const rotationList: Record<Orientation, DeviceSize> = {
    portrait: {
      name: "portrait",
      width: initHeight,
      height: initWidth,
      frameKind: kind,
    },
    landscape: {
      name: "landscape",
      width: initWidth,
      height: initHeight,
      frameKind: kind,
    },
  };

  return rotationList[orientation];
};

const resizeImage = async ({
  buffer,
  size,
}: RenderResizeImageOptions): Promise<{
  buffer: Buffer;
  size: RenderResizeImageOptions["size"];
}> => {
  const canvas = createCanvas(size.width, size.height);
  const context = canvas.getContext("2d");

  context.fillStyle = "#000";
  context.fillRect(0, 0, size.width, size.height);

  const image = await loadImage(buffer);
  context.drawImage(image, 0, 0, size.width, size.height);

  return { buffer: canvas.toBuffer("image/png"), size };
};

const resizeImageToDeviceSize = async ({
  buffer,
  kind,
  orientation = "portrait",
}: ResizeImageToDeviceSizeOptions): Promise<{
  buffer: Buffer;
  size: DeviceSize;
}> => {
  const size = getDeviceSize({ kind, orientation });
  const resized = await resizeImage({ buffer, size });
  return { buffer: resized.buffer, size };
};

const resolveDitherSize = async (
  buffer: Buffer,
  size?: RenderDitherImageOptions["size"],
): Promise<{
  width: number;
  height: number;
  name: string;
  frameKind?: string;
}> => {
  if (size?.width && size?.height) {
    return {
      width: size.width,
      height: size.height,
      name: size.name || (size.height > size.width ? "portrait" : "landscape"),
      frameKind: size.frameKind,
    };
  }

  const image = await loadImage(buffer);
  return {
    width: image.width,
    height: image.height,
    name: image.height > image.width ? "portrait" : "landscape",
  };
};

const ditherImage = async ({
  buffer,
  size,
  palette,
  intent,
  options,
  epdOptimizeSettings,
}: RenderDitherImageOptions): Promise<{
  buffer: Buffer;
  size: { width: number; height: number; name: string; frameKind?: string };
}> => {
  const resolvedSize = await resolveDitherSize(buffer, size);
  const ditherBuffer = await dither(buffer, resolvedSize, {
    enabled: epdOptimizeSettings?.enabled,
    intent: intent ?? epdOptimizeSettings?.intent,
    options: options ?? epdOptimizeSettings?.options,
    palette:
      palette ?? resolveEpdOptimizePalette(epdOptimizeSettings?.paletteName),
  });
  return { buffer: ditherBuffer, size: resolvedSize };
};

const dither = async (
  buffer: Buffer,
  size: { width: number; height: number; name: string; frameKind?: string },
  {
    enabled,
    intent,
    options = {},
    palette = aitjcizeSpectra6Palette,
  }: {
    enabled?: boolean;
    intent?: AutoProcessingIntent;
    options?: Partial<EpdDitherImageOptions>;
    palette?: PaletteColorEntry[];
  } = {},
): Promise<Buffer> => {
  let canvas = createCanvas(size.width, size.height);
  const context = canvas.getContext("2d");

  context.fillStyle = "#000";
  context.fillRect(0, 0, size.width, size.height);

  const image = await loadImage(buffer);

  context.drawImage(image, 0, 0, size.width, size.height);

  const rotatedCanvas = createCanvas(size.height, size.width);
  const rotatedContext = rotatedCanvas.getContext("2d");

  if (size.name === "portrait") {
    rotatedCanvas.width = canvas.height;
    rotatedCanvas.height = canvas.width;

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedContext.rotate(Math.PI / 2);
    rotatedContext.translate(-canvas.width / 2, -canvas.height / 2);
  } else {
    rotatedCanvas.width = canvas.width;
    rotatedCanvas.height = canvas.height;

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    const rotationAngleLandscape =
      size.frameKind === "openpaper13" ? 0 : Math.PI;
    rotatedContext.rotate(rotationAngleLandscape);
    rotatedContext.translate(-canvas.width / 2, -canvas.height / 2);
  }

  rotatedContext.drawImage(canvas, 0, 0);
  canvas = rotatedCanvas;

  if (enabled === false) return canvas.toBuffer("image/png");

  const suggestion = suggestCanvasProcessingOptions(canvas, palette, {
    intent,
  });

  const ditheredCanvas = createCanvas(canvas.width, canvas.height);

  await optimizeCanvas(canvas, ditheredCanvas, {
    ...suggestion.ditherOptions,
    ...options,
    palette,
  });

  replaceColors(ditheredCanvas, canvas, palette);

  return canvas.toBuffer("image/png");
};

export default {
  generateImageFromUrl,
  resizeImageToDeviceSize,
  ditherImage,
};
