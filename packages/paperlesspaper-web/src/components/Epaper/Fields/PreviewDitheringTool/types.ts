import type {
  AutoProcessingIntent,
  DitherImageOptions,
  ProcessingSuggestion,
} from "epdoptimize";

export type PreviewDitheringSettings = {
  useAutoProcessing: boolean;
  autoSettingsSource?: string;
  autoSettingsEdited?: boolean;
  autoIntent: AutoProcessingIntent;
  processingPreset: "none" | "balanced" | "dynamic" | "vivid" | "soft" | "grayscale";
  ditheringType: "errorDiffusion" | "ordered" | "random" | "quantizationOnly";
  errorDiffusionMatrix:
    | "floydSteinberg"
    | "atkinson"
    | "falseFloydSteinberg"
    | "jarvis"
    | "stucki"
    | "burkes"
    | "sierra3"
    | "sierra2"
    | "sierra2-4a";
  serpentine: boolean;
  orderedDitheringType: "bayer";
  orderedDitheringMatrixSize: number;
  randomDitheringType: "blackAndWhite" | "rgb";
  colorMatching: "rgb" | "lab";
  toneMappingMode: "off" | "contrast" | "scurve";
  exposure: number;
  saturation: number;
  contrast: number;
  strength: number;
  shadowBoost: number;
  highlightCompress: number;
  midpoint: number;
  dynamicRangeCompressionMode: "off" | "display" | "auto";
  dynamicRangeCompressionStrength: number;
  dynamicRangeCompressionLowPercentile: number;
  dynamicRangeCompressionHighPercentile: number;
  levelCompressionMode: "off" | "perChannel" | "luma";
  levelCompressionAuto: boolean;
  levelCompressionAutoThreshold: number;
  levelCompressionBlack: number;
  levelCompressionWhite: number;
};

export type PreviewDitheringDebugInfo = {
  generatedAt: string;
  sourceSize: {
    width: number;
    height: number;
  };
  settings: PreviewDitheringSettings;
  effectiveOptions: Omit<DitherImageOptions, "palette"> & {
    palette: "aitjcizeSpectra6Palette";
  };
  suggestion?: ProcessingSuggestion;
};
