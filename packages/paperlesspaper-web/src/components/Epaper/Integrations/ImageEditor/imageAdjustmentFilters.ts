import * as fabric from "fabric";
import {
  aitjcizeSpectra6Palette,
  getProcessingPreset,
  type DitherImageOptions,
} from "epdoptimize";

type RGB = [number, number, number];
type LevelCompressionMode = "off" | "perChannel" | "luma";
type DynamicRangeCompressionMode = "off" | "display" | "auto";

export type EpdImageAdjustmentSettings = {
  exposure: number;
  saturation: number;
  contrast: number;
  strength: number;
  shadowBoost: number;
  highlightCompress: number;
  midpoint: number;
  dynamicRangeCompressionMode: DynamicRangeCompressionMode;
  dynamicRangeCompressionStrength: number;
  dynamicRangeCompressionLowPercentile: number;
  dynamicRangeCompressionHighPercentile: number;
  levelCompressionMode: LevelCompressionMode;
  levelCompressionAuto: boolean;
  levelCompressionAutoThreshold: number;
  levelCompressionBlack: number;
  levelCompressionWhite: number;
};

export const DEFAULT_IMAGE_ADJUSTMENT_SETTINGS: EpdImageAdjustmentSettings = {
  exposure: 1,
  saturation: 1,
  contrast: 1,
  strength: 0,
  shadowBoost: 0,
  highlightCompress: 1.5,
  midpoint: 0.5,
  dynamicRangeCompressionMode: "off",
  dynamicRangeCompressionStrength: 1,
  dynamicRangeCompressionLowPercentile: 0.01,
  dynamicRangeCompressionHighPercentile: 0.99,
  levelCompressionMode: "off",
  levelCompressionAuto: false,
  levelCompressionAutoThreshold: 0.01,
  levelCompressionBlack: 0,
  levelCompressionWhite: 255,
};

let EpdImageAdjustmentsFilterClass: any = null;
let canvas2dFilterBackendConfigured = false;

export const useCanvas2dFilterBackend = () => {
  const Canvas2dFilterBackend =
    (fabric as any).Canvas2dFilterBackend ||
    (fabric as any).Canvas2DFilterBackend;
  if (!Canvas2dFilterBackend || canvas2dFilterBackendConfigured) return;

  if (typeof (fabric as any).setFilterBackend === "function") {
    (fabric as any).setFilterBackend(new Canvas2dFilterBackend());
    canvas2dFilterBackendConfigured = true;
  }
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const clampByte = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 255));
};

const luma709 = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

const hexToRgb = (hex: string): RGB => {
  const normalized = hex
    .replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) =>
      [r, r, g, g, b, b].join(""),
    )
    .replace("#", "");
  const match = normalized.match(/.{2}/g);
  if (!match || match.length !== 3) return [0, 0, 0];
  return match.map((value) => parseInt(value, 16)) as RGB;
};

const rgbToXyz = (r: number, g: number, b: number): RGB => {
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  return [
    (rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375) * 100,
    (rn * 0.2126729 + gn * 0.7151522 + bn * 0.072175) * 100,
    (rn * 0.0193339 + gn * 0.119192 + bn * 0.9503041) * 100,
  ];
};

const xyzToLab = (x: number, y: number, z: number): RGB => {
  let xn = x / 95.047;
  let yn = y / 100;
  let zn = z / 108.883;

  xn = xn > 0.008856 ? Math.pow(xn, 1 / 3) : 7.787 * xn + 16 / 116;
  yn = yn > 0.008856 ? Math.pow(yn, 1 / 3) : 7.787 * yn + 16 / 116;
  zn = zn > 0.008856 ? Math.pow(zn, 1 / 3) : 7.787 * zn + 16 / 116;

  return [116 * yn - 16, 500 * (xn - yn), 200 * (yn - zn)];
};

const rgbToLab = (r: number, g: number, b: number): RGB =>
  xyzToLab(...rgbToXyz(r, g, b));

const labToXyz = (l: number, a: number, b: number): RGB => {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = x > 0.206897 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = y > 0.206897 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = z > 0.206897 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

  return [x * 95.047, y * 100, z * 108.883];
};

const xyzToRgb = (x: number, y: number, z: number): RGB => {
  const xn = x / 100;
  const yn = y / 100;
  const zn = z / 100;

  let r = xn * 3.2404542 + yn * -1.5371385 + zn * -0.4985314;
  let g = xn * -0.969266 + yn * 1.8760108 + zn * 0.041556;
  let b = xn * 0.0556434 + yn * -0.2040259 + zn * 1.0572252;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return [clampByte(r * 255), clampByte(g * 255), clampByte(b * 255)];
};

const labToRgb = (l: number, a: number, b: number): RGB =>
  xyzToRgb(...labToXyz(l, a, b));

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[index];
};

const paletteRgb = aitjcizeSpectra6Palette.map((entry) =>
  hexToRgb(entry.color),
);

const getPaletteEndpoints = () => {
  let darkest = paletteRgb[0];
  let lightest = paletteRgb[0];

  for (const color of paletteRgb) {
    if (luma709(...color) < luma709(...darkest)) darkest = color;
    if (luma709(...color) > luma709(...lightest)) lightest = color;
  }

  return { black: darkest, white: lightest };
};

const applyExposure = (image: ImageData, exposure: number) => {
  if (exposure === 1) return;
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] * exposure);
    data[i + 1] = clampByte(data[i + 1] * exposure);
    data[i + 2] = clampByte(data[i + 2] * exposure);
  }
};

const applyContrast = (image: ImageData, contrast: number) => {
  if (contrast === 1) return;
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte((data[i] - 128) * contrast + 128);
    data[i + 1] = clampByte((data[i + 1] - 128) * contrast + 128);
    data[i + 2] = clampByte((data[i + 2] - 128) * contrast + 128);
  }
};

const applySaturation = (image: ImageData, saturation: number) => {
  if (saturation === 1) return;
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    if (max === min) continue;

    const delta = max - min;
    const sat =
      lightness > 0.5
        ? delta / (2 - max - min)
        : delta / Math.max(max + min, 0.000001);
    const hue =
      max === r
        ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
        : max === g
          ? ((b - r) / delta + 2) / 6
          : ((r - g) / delta + 4) / 6;
    const newSat = clamp(sat * saturation, 0, 1);
    const c = (1 - Math.abs(2 * lightness - 1)) * newSat;
    const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
    const m = lightness - c / 2;
    const sector = Math.floor(hue * 6);
    let rp = 0;
    let gp = 0;
    let bp = 0;

    if (sector === 0) [rp, gp, bp] = [c, x, 0];
    else if (sector === 1) [rp, gp, bp] = [x, c, 0];
    else if (sector === 2) [rp, gp, bp] = [0, c, x];
    else if (sector === 3) [rp, gp, bp] = [0, x, c];
    else if (sector === 4) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];

    data[i] = clampByte((rp + m) * 255);
    data[i + 1] = clampByte((gp + m) * 255);
    data[i + 2] = clampByte((bp + m) * 255);
  }
};

const applyScurveToneMap = (image: ImageData, settings: EpdImageAdjustmentSettings) => {
  if (settings.strength === 0) return;
  const { data } = image;
  const mid = clamp(settings.midpoint, 0.01, 0.99);

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const normalized = data[i + c] / 255;
      const result =
        normalized <= mid
          ? Math.pow(normalized / mid, 1 - settings.strength * settings.shadowBoost) * mid
          : mid +
            Math.pow(
              (normalized - mid) / (1 - mid),
              1 + settings.strength * settings.highlightCompress,
            ) *
              (1 - mid);

      data[i + c] = clampByte(result * 255);
    }
  }
};

const applyToneMapping = (image: ImageData, settings: EpdImageAdjustmentSettings) => {
  applyExposure(image, settings.exposure);
  applySaturation(image, settings.saturation);
  applyContrast(image, settings.contrast);
  applyScurveToneMap(image, settings);
};

const applyDynamicRangeCompression = (
  image: ImageData,
  settings: EpdImageAdjustmentSettings,
) => {
  if (settings.dynamicRangeCompressionMode === "off") return;

  const strength = clamp(settings.dynamicRangeCompressionStrength, 0, 1);
  if (strength === 0) return;

  const { black, white } = getPaletteEndpoints();
  const [blackL] = rgbToLab(...black);
  const [whiteL] = rgbToLab(...white);
  const targetRange = whiteL - blackL;
  if (targetRange <= 0) return;

  const { data } = image;
  let sourceBlackL = 0;
  let sourceWhiteL = 100;

  if (settings.dynamicRangeCompressionMode === "auto") {
    const lightnesses: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      lightnesses.push(rgbToLab(data[i], data[i + 1], data[i + 2])[0]);
    }
    sourceBlackL = percentile(
      lightnesses,
      settings.dynamicRangeCompressionLowPercentile,
    );
    sourceWhiteL = percentile(
      lightnesses,
      settings.dynamicRangeCompressionHighPercentile,
    );
  }

  const sourceRange = sourceWhiteL - sourceBlackL;
  if (sourceRange <= 0.0001) return;

  for (let i = 0; i < data.length; i += 4) {
    const [l, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    const normalizedL = clamp((l - sourceBlackL) / sourceRange, 0, 1);
    const compressedL = blackL + normalizedL * targetRange;
    const blendedL = l + (compressedL - l) * strength;
    const [r, g, blue] = labToRgb(blendedL, a, b);

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = blue;
  }
};

const shouldEnableLevelCompression = (
  image: ImageData,
  settings: EpdImageAdjustmentSettings,
) => {
  const { data } = image;
  const pixelCount = Math.floor(data.length / 4);
  if (pixelCount <= 0) return false;

  let outOfRange = 0;
  if (settings.levelCompressionMode === "perChannel") {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (
        r < settings.levelCompressionBlack ||
        r > settings.levelCompressionWhite ||
        g < settings.levelCompressionBlack ||
        g > settings.levelCompressionWhite ||
        b < settings.levelCompressionBlack ||
        b > settings.levelCompressionWhite
      ) {
        outOfRange++;
      }
    }
  } else {
    for (let i = 0; i < data.length; i += 4) {
      const y = luma709(data[i], data[i + 1], data[i + 2]);
      if (
        y < settings.levelCompressionBlack ||
        y > settings.levelCompressionWhite
      ) {
        outOfRange++;
      }
    }
  }

  return outOfRange / pixelCount >= settings.levelCompressionAutoThreshold;
};

const applyLevelCompression = (
  image: ImageData,
  settings: EpdImageAdjustmentSettings,
) => {
  if (settings.levelCompressionMode === "off") return;
  if (settings.levelCompressionAuto && !shouldEnableLevelCompression(image, settings)) {
    return;
  }

  const { data } = image;
  const black = settings.levelCompressionBlack;
  const white = settings.levelCompressionWhite;
  const range = white - black;
  if (range <= 0) return;

  if (settings.levelCompressionMode === "perChannel") {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clampByte(black + (data[i] * range) / 255);
      data[i + 1] = clampByte(black + (data[i + 1] * range) / 255);
      data[i + 2] = clampByte(black + (data[i + 2] * range) / 255);
    }
    return;
  }

  for (let i = 0; i < data.length; i += 4) {
    const y = luma709(data[i], data[i + 1], data[i + 2]);
    const yNew = black + (y * range) / 255;
    let ratio = y > 0 ? yNew / y : 0;
    const maxChannel = Math.max(data[i], data[i + 1], data[i + 2]);
    if (maxChannel > 0) ratio = Math.min(ratio, 255 / maxChannel);

    data[i] = clampByte(data[i] * ratio);
    data[i + 1] = clampByte(data[i + 1] * ratio);
    data[i + 2] = clampByte(data[i + 2] * ratio);
  }
};

const normalizeSettings = (options: any = {}): EpdImageAdjustmentSettings => {
  const settings = {
    ...DEFAULT_IMAGE_ADJUSTMENT_SETTINGS,
    ...options,
  };

  if (options.toneMappingMode === "off") {
    settings.exposure = 1;
    settings.saturation = 1;
    settings.contrast = 1;
    settings.strength = 0;
    settings.shadowBoost = 0;
    settings.highlightCompress = 1.5;
    settings.midpoint = 0.5;
  } else if (options.toneMappingMode === "contrast") {
    settings.strength = 0;
  } else if (options.toneMappingMode === "scurve") {
    settings.contrast = 1;
  }

  return settings;
};

export const registerEpdImageAdjustmentsIfNeeded = () => {
  useCanvas2dFilterBackend();

  const BaseFilter =
    (fabric as any).filters?.BaseFilter ||
    (fabric as any).Image?.filters?.BaseFilter;
  if (!BaseFilter) return;

  if (EpdImageAdjustmentsFilterClass) return;
  const registry = (fabric as any).classRegistry;
  if (registry?.has?.("EpdImageAdjustments")) {
    EpdImageAdjustmentsFilterClass = registry.getClass("EpdImageAdjustments");
    return;
  }

  class EpdImageAdjustmentsFilter extends BaseFilter {
    static type = "EpdImageAdjustments";
    type = "EpdImageAdjustments";

    constructor(options: Partial<EpdImageAdjustmentSettings> = {}) {
      super(options);
      Object.assign(this, normalizeSettings(options));
    }

    toObject() {
      return {
        ...(super.toObject() as Record<string, unknown>),
        ...getSettingsFromFilter(this as any),
      };
    }

    applyTo2d(opts: { imageData: ImageData }) {
      const settings = getSettingsFromFilter(this as any);

      applyToneMapping(opts.imageData, settings);
      applyDynamicRangeCompression(opts.imageData, settings);
      applyLevelCompression(opts.imageData, settings);
    }
  }

  EpdImageAdjustmentsFilter.fromObject = function (
    obj: Partial<EpdImageAdjustmentSettings>,
    cb?: (filter: any) => void,
  ) {
    const instance = new EpdImageAdjustmentsFilter(obj);
    return cb ? cb(instance) : instance;
  };

  if (registry?.setClass) {
    registry.setClass(EpdImageAdjustmentsFilter, "EpdImageAdjustments");
  }
  EpdImageAdjustmentsFilterClass = EpdImageAdjustmentsFilter;
};

export const ensureEpdImageAdjustmentsFilter = (img: any) => {
  registerEpdImageAdjustmentsIfNeeded();
  img.filters ||= [];
  const FilterClass = EpdImageAdjustmentsFilterClass;
  if (!FilterClass) return null;

  const existing =
    img.filters.find((filter: any) =>
      filter instanceof FilterClass || filter?.type === "EpdImageAdjustments",
    ) ?? null;
  if (existing) return existing;

  const filter = new FilterClass(DEFAULT_IMAGE_ADJUSTMENT_SETTINGS);
  img.filters.push(filter);
  return filter;
};

export const getSettingsFromFilter = (
  filter?: Partial<EpdImageAdjustmentSettings> | null,
): EpdImageAdjustmentSettings => normalizeSettings(filter ?? {});

export const applySettingsToImage = (
  img: any,
  settings: EpdImageAdjustmentSettings,
) => {
  const filter = ensureEpdImageAdjustmentsFilter(img);
  if (!filter) return;

  Object.assign(filter, settings);
  img.applyFilters?.();
};

const normalizeDynamicRangeCompression = (
  dynamicRangeCompression: DitherImageOptions["dynamicRangeCompression"],
) => {
  if (dynamicRangeCompression === true) {
    return { mode: "display" as const, strength: 1 };
  }
  if (!dynamicRangeCompression || dynamicRangeCompression.mode === "off") {
    return undefined;
  }
  return dynamicRangeCompression;
};

export const settingsFromDitherOptions = (
  options: Partial<DitherImageOptions>,
): EpdImageAdjustmentSettings => {
  const preset = options.processingPreset
    ? getProcessingPreset(options.processingPreset)
    : null;
  const toneMapping = {
    ...(preset?.toneMapping ?? {}),
    ...(options.toneMapping ?? {}),
  };
  const dynamicRangeCompression =
    normalizeDynamicRangeCompression(options.dynamicRangeCompression) ??
    normalizeDynamicRangeCompression(preset?.dynamicRangeCompression);
  const levelCompression = options.levelCompression;
  const next = { ...DEFAULT_IMAGE_ADJUSTMENT_SETTINGS };

  next.exposure = toneMapping.exposure ?? next.exposure;
  next.saturation = toneMapping.saturation ?? next.saturation;
  next.contrast =
    toneMapping.mode === "scurve"
      ? next.contrast
      : toneMapping.contrast ?? next.contrast;
  next.strength =
    toneMapping.mode === "contrast"
      ? 0
      : toneMapping.strength ?? next.strength;
  next.shadowBoost = toneMapping.shadowBoost ?? next.shadowBoost;
  next.highlightCompress =
    toneMapping.highlightCompress ?? next.highlightCompress;
  next.midpoint = toneMapping.midpoint ?? next.midpoint;

  if (dynamicRangeCompression) {
    next.dynamicRangeCompressionMode =
      dynamicRangeCompression.mode ?? "display";
    next.dynamicRangeCompressionStrength =
      dynamicRangeCompression.strength ?? next.dynamicRangeCompressionStrength;
    next.dynamicRangeCompressionLowPercentile =
      dynamicRangeCompression.lowPercentile ??
      next.dynamicRangeCompressionLowPercentile;
    next.dynamicRangeCompressionHighPercentile =
      dynamicRangeCompression.highPercentile ??
      next.dynamicRangeCompressionHighPercentile;
  }

  if (levelCompression) {
    next.levelCompressionMode = levelCompression.mode ?? "perChannel";
    next.levelCompressionAuto =
      levelCompression.auto ?? next.levelCompressionAuto;
    next.levelCompressionAutoThreshold =
      levelCompression.autoThreshold ?? next.levelCompressionAutoThreshold;
    next.levelCompressionBlack =
      typeof levelCompression.black === "number"
        ? levelCompression.black
        : next.levelCompressionBlack;
    next.levelCompressionWhite =
      typeof levelCompression.white === "number"
        ? levelCompression.white
        : next.levelCompressionWhite;
  }

  return next;
};
