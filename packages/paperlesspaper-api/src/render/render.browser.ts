import puppeteer from "puppeteer";
import type { Browser, BrowserContext, LaunchOptions, Page } from "puppeteer";
import { adBlock } from "./adBlock.service";
import {
  EPD_OPTIMIZE_META_NAME,
  parseEpdOptimizeMetaContent,
} from "./epdOptimizeMeta";
import type { EpdOptimizeMetaSettings } from "./epdOptimizeMeta";
import { resolveRenderUrl, startRenderProxy } from "./renderNetwork";
import { createAssetCacheStats, renderAssetCache } from "./renderAssetCache";
import { resolveDeviceResolution } from "./renderSize";
import type {
  GenerateImageOptions,
  PuppeteerRenderDiagnostics,
  DeviceSize,
  BrowserViewportSize,
  Orientation,
} from "./render.types";
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
  timezone?: string
): Promise<void> => {
  if (timezone) {
    await page.emulateTimezone(timezone);
  }
};

const READINESS_SELECTOR = "#website-has-loaded" as const;
const READINESS_TIMEOUT_MS = 15_000;
const LEGACY_RENDER_DELAY_MS = 5_000;

const serializeRenderError = (
  error: unknown
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

let sharedBrowser: Browser | null = null;
let sharedBrowserPromise: Promise<Browser> | null = null;

const browserLaunchArgs = [
  // The default context must not have direct network access. Render contexts
  // override this with their own filtering proxy before any page is created.
  "--proxy-server=http://127.0.0.1:9",
  "--proxy-bypass-list=<-loopback>",
  "--disable-quic",
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
];

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
  if (sharedBrowser && sharedBrowser.connected) {
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

export const closeRenderBrowser = async (): Promise<void> => {
  const browser = sharedBrowser || (await sharedBrowserPromise);
  sharedBrowser = null;
  sharedBrowserPromise = null;
  await browser?.close();
};

export const generateImageFromUrl = async (
  {
    token,
    scroll = 0,
    url,
    orientation = "portrait",
    data,
    paper,
    css,
    kind = "epd7",
    timezone,
  }: GenerateImageOptions,
  signal?: AbortSignal
): Promise<{
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
  let context: BrowserContext | null = null;
  let proxy: Awaited<ReturnType<typeof startRenderProxy>> | null = null;
  let urlLocal = String(url || "");

  const renderStartedAt = new Date();
  const timings: Record<string, number> = {};
  const assetCache = createAssetCacheStats();
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
    action: () => Promise<T>
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
    error?: unknown
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
      assetCache: { ...assetCache },
      ...(error ? { error: serializeRenderError(error) } : {}),
    };
  };

  const abort = () => {
    void context?.close().catch(() => {});
    void proxy?.close().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    signal?.throwIfAborted();
    urlLocal = resolveRenderUrl(urlLocal);
    proxy = await startRenderProxy();
    signal?.throwIfAborted();
    const browser = await measure("browserMs", () => getBrowser());
    signal?.throwIfAborted();
    context = await browser.createBrowserContext({
      proxyServer: proxy.url,
      proxyBypassList: ["<-loopback>"],
      downloadBehavior: { policy: "deny" },
    });
    signal?.throwIfAborted();
    page = await measure("pageCreationMs", () => context!.newPage());
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      let allowed = false;
      try {
        const protocol = new URL(request.url()).protocol;
        allowed = ["http:", "https:", "data:", "blob:", "about:"].includes(
          protocol
        );
      } catch {
        /* Invalid request URLs fail closed. */
      }
      // Ordinary requests (including workers/popups) use the proxy. Eligible
      // public assets use a bounded anonymous loader with the same IP policy.
      void (async () => {
        if (!allowed) return request.abort("blockedbyclient");
        const asset = await renderAssetCache
          .get(
            {
              url: request.url(),
              method: request.method(),
              resourceType: request.resourceType(),
              headers: request.headers(),
            },
            assetCache
          )
          .catch(() => null);
        if (request.isInterceptResolutionHandled()) return;
        if (asset) {
          const age = Math.ceil(
            Number(asset.headers.age || 0) +
              (Date.now() - asset.storedAt) / 1000
          );
          return request.respond({
            status: 200,
            headers: { ...asset.headers, age: String(age) },
            body: asset.body,
          });
        }
        return request.continue();
      })().catch(() => {
        /* The context may have closed while handling a request. */
      });
    });
    if (timezone) {
      await measure("timezoneMs", () => emulatePageTimezone(page!, timezone));
    }
    await measure("viewportMs", () =>
      page!.setViewport({
        width: size.width,
        height: size.height,
        deviceScaleFactor: 1,
      })
    );

    const navigationResponse = await measure("navigationMs", () =>
      page!.goto(urlLocal, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      })
    );
    // Reject explicit HTTP errors only. Other responses (including cached
    // documents reported as 304) still need to pass the render readiness checks.
    if (navigationResponse && navigationResponse.status() >= 400) {
      throw new Error(
        `Render page returned HTTP ${navigationResponse.status()}`
      );
    }
    await measure("adBlockMs", () => adBlock(page!));
    //console.log('AdBlock applied');

    const readReadinessMarkers = () =>
      page!.evaluate(() => ({
        loading: Boolean(
          document.querySelector("#website-has-loading-element")
        ),
        loaded: Boolean(document.querySelector("#website-has-loaded")),
      }));

    let markersBeforeInit = await measure(
      "markerCheckBeforeInitMs",
      readReadinessMarkers
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
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );
      markersBeforeInit = await measure(
        "markerRecheckBeforeInitMs",
        readReadinessMarkers
      );
    }

    //console.log('Checking for loading element:', loadingElementExists);

    if (data && paper?.kind !== "plugin") {
      await measure("legacyDataDispatchMs", () =>
        page!.evaluate((payload) => {
          window.postMessage(
            { cmd: "message", data: payload, type: "GOOGLECALENDAR" },
            "*"
          );
        }, data)
      );
      legacyDataPayloadSent = true;
    }

    const initPayload = getRenderInitPayload({ data, paper });
    if (initPayload) {
      await measure("initDispatchMs", () =>
        page!.evaluate((payload) => {
          window.postMessage(
            { cmd: "message", data: payload, type: "INIT" },
            "*"
          );
        }, initPayload)
      );
      initPayloadSent = true;
    }

    const markersAfterInit = await measure("markerCheckAfterInitMs", () =>
      page!.evaluate(() => ({
        loading: Boolean(
          document.querySelector("#website-has-loading-element")
        ),
        loaded: Boolean(document.querySelector("#website-has-loaded")),
      }))
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
        setTimeout(resolve, LEGACY_RENDER_DELAY_MS)
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
          ".pp-error, [role='alert']"
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
      })
    )) as PuppeteerRenderDiagnostics["pageState"];

    // Keep the previous image when an integration never finishes loading.
    if (readiness.outcome === "timeout" || pageState.status === "loading") {
      throw new Error("Render page did not finish loading");
    }

    //console.log('render finished:', scroll);
    if (css) {
      await measure("customCssMs", () =>
        page!.addStyleTag({
          content: `${css}`,
        })
      );
    }

    epdOptimizeSettings = await measure("epdOptimizeMetaMs", async () => {
      const content = await page!.evaluate(
        (metaName) =>
          document
            .querySelector(`meta[name="${metaName}"]`)
            ?.getAttribute("content"),
        EPD_OPTIMIZE_META_NAME
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
      url: sanitizeRenderUrl(urlLocal),
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      buffer: null,
      size,
      diagnostics: finishDiagnostics("error", error),
    };
  } finally {
    signal?.removeEventListener("abort", abort);
    if (context) {
      try {
        // Closes popups/workers and discards cookies/storage as well as the page.
        await context.close();
      } catch (closeError) {
        //console.log('Page close error:', closeError);
      }
    }
    await proxy?.close();
  }
};

// Startup/readiness probes exercise Chromium with its sandbox enabled.
export const warmRenderBrowser = async () => {
  await getBrowser();
};
export default { generateImageFromUrl };
