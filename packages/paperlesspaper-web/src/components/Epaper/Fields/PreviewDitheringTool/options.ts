import type { DitherImageOptions, ProcessingSuggestion } from "epdoptimize";
import type {
  PreviewDitheringDebugInfo,
  PreviewDitheringSettings,
} from "./types";

export const DEFAULT_PREVIEW_DITHERING_SETTINGS: PreviewDitheringSettings = {
  useAutoProcessing: true,
  autoSettingsEdited: false,
  autoIntent: "natural",
  processingPreset: "balanced",
  ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "floydSteinberg",
  serpentine: true,
  orderedDitheringType: "bayer",
  orderedDitheringMatrixSize: 4,
  randomDitheringType: "blackAndWhite",
  colorMatching: "rgb",
  toneMappingMode: "contrast",
  exposure: 1,
  saturation: 1,
  contrast: 1,
  strength: 0.9,
  shadowBoost: 0,
  highlightCompress: 1.5,
  midpoint: 0.5,
  dynamicRangeCompressionMode: "display",
  dynamicRangeCompressionStrength: 1,
  dynamicRangeCompressionLowPercentile: 0.01,
  dynamicRangeCompressionHighPercentile: 0.99,
  levelCompressionMode: "off",
  levelCompressionAuto: false,
  levelCompressionAutoThreshold: 0.01,
  levelCompressionBlack: 0,
  levelCompressionWhite: 255,
};

const processingPresets: PreviewDitheringSettings["processingPreset"][] = [
  "none",
  "balanced",
  "dynamic",
  "vivid",
  "soft",
  "grayscale",
];
const ditheringTypes: PreviewDitheringSettings["ditheringType"][] = [
  "errorDiffusion",
  "ordered",
  "random",
  "quantizationOnly",
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
];
const toneMappingModes: PreviewDitheringSettings["toneMappingMode"][] = [
  "off",
  "contrast",
  "scurve",
];
const dynamicRangeCompressionModes: PreviewDitheringSettings["dynamicRangeCompressionMode"][] =
  ["off", "display", "auto"];
const levelCompressionModes: PreviewDitheringSettings["levelCompressionMode"][] =
  ["off", "perChannel", "luma"];

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const toPercentile = (value: number) => clampNumber(value, 0, 1);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

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

  if (options.processingPreset) {
    next.processingPreset = pick(
      options.processingPreset,
      processingPresets,
      next.processingPreset,
    );
  }
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

  const toneMapping = options.toneMapping;
  if (toneMapping) {
    next.toneMappingMode = pick(
      toneMapping.mode,
      toneMappingModes,
      next.toneMappingMode,
    );
    if (isNumber(toneMapping.exposure)) next.exposure = toneMapping.exposure;
    if (isNumber(toneMapping.saturation))
      next.saturation = toneMapping.saturation;
    if (isNumber(toneMapping.contrast)) next.contrast = toneMapping.contrast;
    if (isNumber(toneMapping.strength)) next.strength = toneMapping.strength;
    if (isNumber(toneMapping.shadowBoost))
      next.shadowBoost = toneMapping.shadowBoost;
    if (isNumber(toneMapping.highlightCompress))
      next.highlightCompress = toneMapping.highlightCompress;
    if (isNumber(toneMapping.midpoint)) next.midpoint = toneMapping.midpoint;
  }

  const dynamicRangeCompression = options.dynamicRangeCompression;
  if (dynamicRangeCompression === true) {
    next.dynamicRangeCompressionMode = "display";
    next.dynamicRangeCompressionStrength = 1;
  } else if (
    dynamicRangeCompression &&
    typeof dynamicRangeCompression === "object"
  ) {
    next.dynamicRangeCompressionMode = pick(
      dynamicRangeCompression.mode,
      dynamicRangeCompressionModes,
      next.dynamicRangeCompressionMode,
    );
    if (isNumber(dynamicRangeCompression.strength)) {
      next.dynamicRangeCompressionStrength = dynamicRangeCompression.strength;
    }
    if (isNumber(dynamicRangeCompression.lowPercentile)) {
      next.dynamicRangeCompressionLowPercentile =
        dynamicRangeCompression.lowPercentile;
    }
    if (isNumber(dynamicRangeCompression.highPercentile)) {
      next.dynamicRangeCompressionHighPercentile =
        dynamicRangeCompression.highPercentile;
    }
  }

  const levelCompression = options.levelCompression;
  if (levelCompression) {
    next.levelCompressionMode = pick(
      levelCompression.mode,
      levelCompressionModes,
      next.levelCompressionMode,
    );
    if (typeof levelCompression.auto === "boolean") {
      next.levelCompressionAuto = levelCompression.auto;
    }
    if (isNumber(levelCompression.autoThreshold)) {
      next.levelCompressionAutoThreshold = levelCompression.autoThreshold;
    }
    if (isNumber(levelCompression.black)) {
      next.levelCompressionBlack = levelCompression.black;
    }
    if (isNumber(levelCompression.white)) {
      next.levelCompressionWhite = levelCompression.white;
    }
  }

  return next;
}

export function buildPreviewDitherOptions(
  settings: PreviewDitheringSettings,
  suggestion?: ProcessingSuggestion,
): Omit<DitherImageOptions, "palette"> {
  if (settings.useAutoProcessing && !settings.autoSettingsEdited) {
    return {
      ...suggestion?.ditherOptions,
    };
  }

  const options: Omit<DitherImageOptions, "palette"> = {
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
    toneMapping: {
      mode: settings.toneMappingMode,
      exposure: settings.exposure,
      saturation: settings.saturation,
      contrast: settings.contrast,
      strength: settings.strength,
      shadowBoost: settings.shadowBoost,
      highlightCompress: settings.highlightCompress,
      midpoint: settings.midpoint,
    },
    dynamicRangeCompression: {
      mode: settings.dynamicRangeCompressionMode,
      strength: clampNumber(settings.dynamicRangeCompressionStrength, 0, 1),
      lowPercentile: toPercentile(
        settings.dynamicRangeCompressionLowPercentile,
      ),
      highPercentile: toPercentile(
        settings.dynamicRangeCompressionHighPercentile,
      ),
    },
  };

  if (settings.processingPreset !== "none") {
    options.processingPreset = settings.processingPreset;
  }

  if (settings.levelCompressionMode !== "off") {
    options.levelCompression = {
      mode: settings.levelCompressionMode,
      auto: settings.levelCompressionAuto,
      autoThreshold: settings.levelCompressionAutoThreshold,
      black: settings.levelCompressionBlack,
      white: settings.levelCompressionWhite,
    };
  }

  return options;
}

export function buildPreviewDebugInfo({
  settings,
  effectiveOptions,
  suggestion,
  sourceCanvas,
}: {
  settings: PreviewDitheringSettings;
  effectiveOptions: Omit<DitherImageOptions, "palette">;
  suggestion?: ProcessingSuggestion;
  sourceCanvas: HTMLCanvasElement;
}): PreviewDitheringDebugInfo {
  return {
    generatedAt: new Date().toISOString(),
    sourceSize: {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    },
    settings,
    effectiveOptions: {
      ...effectiveOptions,
      palette: "aitjcizeSpectra6Palette",
    },
    suggestion,
  };
}
