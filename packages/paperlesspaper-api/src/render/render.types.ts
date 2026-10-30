import type { AssetCacheStats } from "./renderAssetCache";
import type { EpdOptimizeMetaSettings } from "./epdOptimizeMeta";

export type GenerateImageOptions = {
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
  assetCache: AssetCacheStats;
  error?: { name?: string; message: string };
};

export type Orientation = "portrait" | "landscape";

export type DeviceSize = {
  width: number;
  height: number;
  name: Orientation;
  frameKind: string;
};

export type BrowserViewportSize = DeviceSize & {
  value: number;
};

export type RenderResult = {
  buffer: Buffer | null;
  size: DeviceSize;
  diagnostics: PuppeteerRenderDiagnostics;
  epdOptimizeSettings?: EpdOptimizeMetaSettings;
};
