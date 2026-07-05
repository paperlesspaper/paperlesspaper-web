import type { DitherImageOptions, ProcessingSuggestion } from "epdoptimize";
import type {
  PreviewDitheringDebugInfo,
  PreviewDitheringSettings,
} from "./types";

export const DEFAULT_PREVIEW_DITHERING_SETTINGS: PreviewDitheringSettings = {
  useAutoProcessing: true,
  autoSettingsEdited: false,
  autoIntent: "natural",
  ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "floydSteinberg",
  serpentine: true,
  orderedDitheringType: "bayer",
  orderedDitheringMatrixSize: 4,
  randomDitheringType: "blackAndWhite",
  colorMatching: "rgb",
  useFastPreviewAnalysis: true,
  skipUnneededPreviewSuggestions: true,
  useBlobPreviewImages: true,
  useAcceleratedPreviewProcessing: true,
};

const ditheringTypes: PreviewDitheringSettings["ditheringType"][] = [
  "errorDiffusion",
  "ordered",
  "random",
  "quantizationOnly",
  "hueMix",
];
const errorDiffusionMatrices: PreviewDitheringSettings["errorDiffusionMatrix"][] =
  [
    "floydSteinberg",
    "atkinson",
    "falseFloydSteinberg",
    "jarvis",
    "stucki",
    "burkes",
    "sierra3",
    "sierra2",
    "sierra2-4a",
  ];
const randomDitheringTypes: PreviewDitheringSettings["randomDitheringType"][] =
  ["blackAndWhite", "rgb"];
const colorMatchingModes: PreviewDitheringSettings["colorMatching"][] = [
  "rgb",
  "lab",
  "chroma",
];
export const FAST_PREVIEW_MAX_LONG_EDGE = 1280;

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const pick = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => {
  return allowed.includes(value as T) ? (value as T) : fallback;
};

export function getPreviewSuggestionSettingsSource(
  suggestion?: ProcessingSuggestion,
) {
  if (!suggestion) return undefined;
  return JSON.stringify({
    imageKind: suggestion.imageKind,
    intent: suggestion.intent,
    ditherOptions: suggestion.ditherOptions,
  });
}

const pickDitherOptions = (
  options?: Partial<DitherImageOptions>,
): Omit<DitherImageOptions, "palette"> => {
  const next: Omit<DitherImageOptions, "palette"> = {};

  if (!options) return next;

  if (options.ditheringType) {
    next.ditheringType = options.ditheringType;
  }
  if (options.errorDiffusionMatrix) {
    next.errorDiffusionMatrix = options.errorDiffusionMatrix;
  }
  if (options.algorithm) {
    next.algorithm = options.algorithm;
  }
  if (typeof options.serpentine === "boolean") {
    next.serpentine = options.serpentine;
  }
  if (options.orderedDitheringType) {
    next.orderedDitheringType = options.orderedDitheringType;
  }
  if (Array.isArray(options.orderedDitheringMatrix)) {
    next.orderedDitheringMatrix = options.orderedDitheringMatrix;
  }
  if (options.randomDitheringType) {
    next.randomDitheringType = options.randomDitheringType;
  }
  if (options.colorMatching) {
    next.colorMatching = options.colorMatching;
  }
  if (typeof options.sampleColorsFromImage === "boolean") {
    next.sampleColorsFromImage = options.sampleColorsFromImage;
  }
  if (typeof options.numberOfSampleColors === "number") {
    next.numberOfSampleColors = options.numberOfSampleColors;
  }

  return next;
};

export function applyDitherOptionsToPreviewSettings({
  settings,
  options,
  source,
}: {
  settings: PreviewDitheringSettings;
  options?: Partial<DitherImageOptions>;
  source?: string;
}): PreviewDitheringSettings {
  const next: PreviewDitheringSettings = {
    ...settings,
    autoSettingsSource: source,
    autoSettingsEdited: false,
  };

  if (!options) return next;

  if (options.ditheringType) {
    next.ditheringType = pick(
      options.ditheringType,
      ditheringTypes,
      next.ditheringType,
    );
  }
  if (options.errorDiffusionMatrix) {
    next.errorDiffusionMatrix = pick(
      options.errorDiffusionMatrix,
      errorDiffusionMatrices,
      next.errorDiffusionMatrix,
    );
  }
  if (typeof options.serpentine === "boolean") {
    next.serpentine = options.serpentine;
  }
  if (Array.isArray(options.orderedDitheringMatrix)) {
    const size = Number(options.orderedDitheringMatrix[0]);
    if (Number.isFinite(size)) {
      next.orderedDitheringMatrixSize = clampNumber(Math.round(size), 2, 8);
    }
  }
  if (options.randomDitheringType) {
    next.randomDitheringType = pick(
      options.randomDitheringType,
      randomDitheringTypes,
      next.randomDitheringType,
    );
  }
  if (options.colorMatching) {
    next.colorMatching = pick(
      options.colorMatching,
      colorMatchingModes,
      next.colorMatching,
    );
  }

  return next;
}

export function buildPreviewDitherOptions(
  settings: PreviewDitheringSettings,
  suggestion?: ProcessingSuggestion,
): Omit<DitherImageOptions, "palette"> {
  const engineOptions = settings.useAcceleratedPreviewProcessing
    ? {
        processingEngine: "auto" as const,
        adjustmentEngine: "auto" as const,
      }
    : {
        processingEngine: "js" as const,
        adjustmentEngine: "js" as const,
      };

  if (settings.useAutoProcessing && !settings.autoSettingsEdited) {
    return {
      ...engineOptions,
      ...pickDitherOptions(suggestion?.ditherOptions),
    };
  }

  return {
    ...engineOptions,
    ditheringType: settings.ditheringType,
    errorDiffusionMatrix: settings.errorDiffusionMatrix,
    serpentine: settings.serpentine,
    orderedDitheringType: settings.orderedDitheringType,
    orderedDitheringMatrix: [
      settings.orderedDitheringMatrixSize,
      settings.orderedDitheringMatrixSize,
    ],
    randomDitheringType: settings.randomDitheringType,
    colorMatching: settings.colorMatching,
  };
}

export function buildPreviewDebugInfo({
  settings,
  effectiveOptions,
  suggestion,
  sourceCanvas,
  processingSize,
  previewOptimizations,
  timingsMs,
}: {
  settings: PreviewDitheringSettings;
  effectiveOptions: Omit<DitherImageOptions, "palette">;
  suggestion?: ProcessingSuggestion;
  sourceCanvas: HTMLCanvasElement;
  processingSize?: PreviewDitheringDebugInfo["processingSize"];
  previewOptimizations?: PreviewDitheringDebugInfo["previewOptimizations"];
  timingsMs?: PreviewDitheringDebugInfo["timingsMs"];
}): PreviewDitheringDebugInfo {
  return {
    generatedAt: new Date().toISOString(),
    sourceSize: {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    },
    processingSize,
    previewOptimizations,
    timingsMs,
    settings,
    effectiveOptions: {
      ...effectiveOptions,
      palette: "aitjcizeSpectra6Palette",
    },
    suggestion,
  };
}
