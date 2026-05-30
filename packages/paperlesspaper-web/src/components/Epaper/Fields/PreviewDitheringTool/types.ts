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
  ditheringType:
    | "errorDiffusion"
    | "ordered"
    | "random"
    | "quantizationOnly"
    | "hueMix";
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
  colorMatching: "rgb" | "lab" | "chroma";
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
