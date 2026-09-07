import qs from "qs";

export type FrameSize = {
  width: number;
  height: number;
};

export const FRAME_FINISHES = ["black", "light-wood", "white"] as const;
export type FrameFinish = (typeof FRAME_FINISHES)[number];
export const DEFAULT_FRAME_FINISH: FrameFinish = "black";

export type FrameDecorationRatios = {
  framePaddingRatio: number;
  matPaddingRatio: number;
};

export type FrameDecoration = {
  framePadding: number;
  matPadding: number;
};

export type ContainedFrameLayout = {
  decoration: FrameDecoration;
  frame: FrameSize;
  viewport: FrameSize;
  scale: number;
};

export type DeviceImageSyncState = {
  latestImageIsOnDevice: boolean;
  latestImageSyncIsPending: boolean;
};

export type DeviceSyncDisplayState =
  | "updating"
  | "offline"
  | "current"
  | "pending"
  | "trying";

const TIMESTAMP_MILLISECONDS_THRESHOLD = 1_000_000_000_000;
const UPDATING_WINDOW_MS = 60_000;

export const EMPTY_FRAME_DECORATION: FrameDecorationRatios = {
  framePaddingRatio: 0,
  matPaddingRatio: 0,
};
export const PRIMARY_FRAME_DECORATION: FrameDecorationRatios = {
  framePaddingRatio: 0.035,
  matPaddingRatio: 0.1,
} as const;

export function normalizeFrameFinish(value: unknown): FrameFinish {
  return FRAME_FINISHES.includes(value as FrameFinish)
    ? (value as FrameFinish)
    : DEFAULT_FRAME_FINISH;
}

export function mergeUrlWithQueryParams(
  baseUrl?: string | null,
  params?: Record<string, unknown>,
  options?: { includeParams?: boolean }
): string | null {
  if (!baseUrl) return null;
  if (options?.includeParams === false) return baseUrl;

  const [urlWithoutHash, hash = ""] = baseUrl.split("#", 2);
  const [pathname, existingQuery = ""] = urlWithoutHash.split("?", 2);
  const mergedQuery = qs.stringify(
    {
      ...qs.parse(existingQuery, { ignoreQueryPrefix: true }),
      ...(params || {}),
    },
    { addQueryPrefix: true }
  );

  return `${pathname}${mergedQuery}${hash ? `#${hash}` : ""}`;
}

export function isHttpUrl(value?: string | null): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : NaN;
  const timestamp = Number.isFinite(numericValue)
    ? numericValue
    : new Date(value as string).getTime();

  if (!Number.isFinite(timestamp)) return null;

  return timestamp < TIMESTAMP_MILLISECONDS_THRESHOLD
    ? timestamp * 1000
    : timestamp;
}

export function toValidDate(value: unknown): Date | null {
  const timestamp = normalizeTimestamp(value);
  return timestamp === null ? null : new Date(timestamp);
}

export function deriveDeviceImageSyncState(status?: {
  pictureSynced?: boolean;
  fileVersion?: unknown;
  lastReachableAgo?: unknown;
}): DeviceImageSyncState {
  const fileVersionTimestamp = normalizeTimestamp(status?.fileVersion);
  const lastReachableTimestamp = normalizeTimestamp(status?.lastReachableAgo);
  const hasComparableTimestamps =
    fileVersionTimestamp !== null && lastReachableTimestamp !== null;

  return {
    latestImageIsOnDevice:
      status?.pictureSynced === true &&
      (!hasComparableTimestamps ||
        lastReachableTimestamp >= fileVersionTimestamp),
    latestImageSyncIsPending:
      status?.pictureSynced === false ||
      (hasComparableTimestamps &&
        lastReachableTimestamp < fileVersionTimestamp),
  };
}

export function deriveDeviceSyncDisplayState({
  latestImageIsOnDevice,
  nextDeviceSync,
  now,
}: {
  latestImageIsOnDevice: boolean;
  nextDeviceSync: Date | null;
  now: Date;
}): DeviceSyncDisplayState {
  if (!nextDeviceSync) return "trying";

  const millisecondsUntilSync = nextDeviceSync.getTime() - now.getTime();

  if (
    millisecondsUntilSync <= 0 &&
    millisecondsUntilSync > -UPDATING_WINDOW_MS
  ) {
    return "updating";
  }

  if (millisecondsUntilSync <= -UPDATING_WINDOW_MS) return "offline";
  if (latestImageIsOnDevice) return "current";
  return "pending";
}

export function containFrame(
  available: FrameSize,
  display: FrameSize,
  decorationRatios: FrameDecorationRatios = EMPTY_FRAME_DECORATION
): ContainedFrameLayout {
  const framePaddingRatio = Math.max(decorationRatios.framePaddingRatio, 0);
  const matPaddingRatio = Math.max(decorationRatios.matPaddingRatio, 0);
  const paddingRatio = framePaddingRatio + matPaddingRatio;
  const viewportRatio = 1 - paddingRatio * 2;
  const displayShortEdge = Math.min(display.width, display.height);
  const frameShortEdge =
    displayShortEdge > 0 && viewportRatio > 0
      ? displayShortEdge / viewportRatio
      : 0;
  const naturalDecoration = {
    framePadding: frameShortEdge * framePaddingRatio,
    matPadding: frameShortEdge * matPaddingRatio,
  };
  const totalPadding =
    (naturalDecoration.framePadding + naturalDecoration.matPadding) * 2;
  const naturalFrame = {
    width: display.width + totalPadding,
    height: display.height + totalPadding,
  };
  const scaleCandidates: number[] = [];

  if (naturalFrame.width > 0 && available.width > 0) {
    scaleCandidates.push(available.width / naturalFrame.width);
  }

  // An auto-height container reports zero height before its child is sized.
  // In that case width is the only constraint and establishes the height.
  if (naturalFrame.height > 0 && available.height > 0) {
    scaleCandidates.push(available.height / naturalFrame.height);
  }

  const scale = Math.max(
    0,
    scaleCandidates.length > 0 ? Math.min(...scaleCandidates) : 0
  );
  const viewport = {
    width: display.width * scale,
    height: display.height * scale,
  };
  const decoration = {
    framePadding: naturalDecoration.framePadding * scale,
    matPadding: naturalDecoration.matPadding * scale,
  };

  return {
    decoration,
    scale,
    viewport,
    frame: {
      width: naturalFrame.width * scale,
      height: naturalFrame.height * scale,
    },
  };
}
