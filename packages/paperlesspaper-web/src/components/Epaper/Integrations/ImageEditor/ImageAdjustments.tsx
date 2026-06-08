import {
  faArrowsLeftRightToLine,
  faCircleHalfStroke,
  faMoon,
  faSun,
  faSunBright,
  faWandMagicSparkles,
} from "@fortawesome/pro-regular-svg-icons";
import { faRotate, faTint } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Checkbox, Select, SelectItem } from "@progressiveui/react";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import {
  aitjcizeSpectra6Palette,
  suggestCanvasImageAdjustmentOptions,
} from "epdoptimize";
import EditorButton from "./EditorButton";
import { useImageEditorContext } from "./ImageEditor";
import {
  applySettingsToImage,
  DEFAULT_IMAGE_ADJUSTMENT_SETTINGS,
  ensureEpdImageAdjustmentsFilter,
  getSettingsFromFilter,
  registerEpdImageAdjustmentsIfNeeded,
  settingsFromDitherOptions,
  type EpdImageAdjustmentSettings,
  useCanvas2dFilterBackend,
} from "./imageAdjustmentFilters";
import styles from "./imageAdjustments.module.scss";
import ValueChanger from "./ValueChanger";
import Clarity from "./Clarity";

const dynamicRangeCompressionModes: EpdImageAdjustmentSettings["dynamicRangeCompressionMode"][] =
  ["off", "display", "auto"];
const levelCompressionModes: EpdImageAdjustmentSettings["levelCompressionMode"][] =
  ["off", "perChannel", "luma"];
const TONE_HISTOGRAM_BINS = 48;

type NumericAdjustmentKey = {
  [K in keyof EpdImageAdjustmentSettings]: EpdImageAdjustmentSettings[K] extends number
    ? K
    : never;
}[keyof EpdImageAdjustmentSettings];

function title(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function clampLevel(value: number, min = 0, max = 255) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function clampRatio(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value * 100) / 100, min), max);
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function getActiveImage(fabricRef: any) {
  const img = fabricRef.current?.getActiveObject?.();
  if (!img || img.type !== "image") return null;
  img.filters ||= [];
  return img;
}

function createCanvasFromImage(img: any) {
  const rendered = img.toCanvasElement?.({
    enableRetinaScaling: false,
    withoutTransform: true,
  });

  if (rendered?.width && rendered?.height) {
    return rendered;
  }

  const source = img._originalElement || img._element;
  const width = source?.naturalWidth || source?.width || img.width || 1;
  const height = source?.naturalHeight || source?.height || img.height || 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context?.drawImage(source, 0, 0, width, height);
  return canvas;
}

function getToneHistogram(img: any, bins = TONE_HISTOGRAM_BINS) {
  try {
    const canvas = createCanvasFromImage(img);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) return [];

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const counts = Array.from({ length: bins }, () => 0);
    const totalPixels = canvas.width * canvas.height;
    const sampleEvery = Math.max(1, Math.floor(totalPixels / 20000));

    for (
      let pixelIndex = 0;
      pixelIndex < totalPixels;
      pixelIndex += sampleEvery
    ) {
      const dataIndex = pixelIndex * 4;
      const alpha = data[dataIndex + 3];
      if (alpha === 0) continue;

      const luminance =
        (0.2126 * data[dataIndex] +
          0.7152 * data[dataIndex + 1] +
          0.0722 * data[dataIndex + 2]) /
        255;
      const bin = Math.min(bins - 1, Math.floor(luminance * bins));
      counts[bin] += alpha / 255;
    }

    const maxCount = Math.max(...counts);
    if (maxCount <= 0) return [];

    return counts.map((count) => Math.sqrt(count / maxCount));
  } catch {
    return [];
  }
}

function useToneHistogram() {
  const { fabricRef }: any = useImageEditorContext();

  return React.useMemo(() => {
    const img = getActiveImage(fabricRef);
    return img ? getToneHistogram(img) : [];
  }, [fabricRef]);
}

function useImageAdjustmentSettings() {
  const { fabricRef }: any = useImageEditorContext();
  const applyTimeout = React.useRef<number | null>(null);
  const [settings, setSettings] = React.useState<EpdImageAdjustmentSettings>(
    () => {
      const img = getActiveImage(fabricRef);
      const filter = img ? ensureEpdImageAdjustmentsFilter(img) : null;
      return getSettingsFromFilter(filter);
    },
  );

  const applySettings = React.useCallback(
    (next: EpdImageAdjustmentSettings) => {
      const img = getActiveImage(fabricRef);
      if (!img) return;

      if (applyTimeout.current !== null) {
        window.clearTimeout(applyTimeout.current);
      }

      applyTimeout.current = window.setTimeout(() => {
        useCanvas2dFilterBackend();
        applySettingsToImage(img, next);
        fabricRef.current?.requestRenderAll?.();
        applyTimeout.current = null;
      }, 70);
    },
    [fabricRef],
  );

  useEffect(
    () => () => {
      if (applyTimeout.current !== null) {
        window.clearTimeout(applyTimeout.current);
      }
    },
    [],
  );

  const updateSettings = React.useCallback(
    (next: EpdImageAdjustmentSettings) => {
      setSettings(next);
      applySettings(next);
    },
    [applySettings],
  );

  const update = React.useCallback(
    <K extends keyof EpdImageAdjustmentSettings>(
      key: K,
      value: EpdImageAdjustmentSettings[K],
    ) => {
      setSettings((previous) => {
        const next = {
          ...previous,
          [key]: value,
        };
        applySettings(next);
        return next;
      });
    },
    [applySettings],
  );

  const sliderUpdate =
    <K extends NumericAdjustmentKey>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      update(
        key,
        (Number.isNaN(value) ? 0 : value) as EpdImageAdjustmentSettings[K],
      );
    };

  const applyAuto = React.useCallback(() => {
    const img = getActiveImage(fabricRef);
    if (!img) return;

    const sourceCanvas = createCanvasFromImage(img);
    const suggestion = suggestCanvasImageAdjustmentOptions(
      sourceCanvas,
      aitjcizeSpectra6Palette,
    );
    updateSettings(settingsFromDitherOptions(suggestion.adjustmentOptions));
  }, [fabricRef, updateSettings]);

  const reset = React.useCallback(() => {
    updateSettings(DEFAULT_IMAGE_ADJUSTMENT_SETTINGS);
  }, [updateSettings]);

  return {
    settings,
    update,
    sliderUpdate,
    applyAuto,
    reset,
  };
}

interface SingleValueModalProps {
  settingKey: NumericAdjustmentKey;
  min: number;
  max: number;
  step: number;
  defaultPoint: number;
  children: React.ReactNode;
}

function SingleValueModal({
  settingKey,
  min,
  max,
  step,
  defaultPoint,
  children,
}: SingleValueModalProps) {
  const { settings, sliderUpdate } = useImageAdjustmentSettings();

  return (
    <ValueChanger
      min={min}
      max={max}
      step={step}
      value={settings[settingKey] as number}
      defaultPoint={defaultPoint}
      onChange={sliderUpdate(settingKey)}
    >
      {children}
    </ValueChanger>
  );
}

function toneCurveValue(
  input: number,
  settings: Pick<
    EpdImageAdjustmentSettings,
    "toneStrength" | "shadows" | "highlights" | "toneMidpoint"
  >,
) {
  const usesCurve = settings.shadows !== 0 || settings.highlights !== 0;
  if (!usesCurve || settings.toneStrength === 0) return input;
  const mid = clampNumber(settings.toneMidpoint, 0.01, 0.99);
  const shadowExponent = clampNumber(
    1 - settings.toneStrength * settings.shadows * 1.5,
    0.15,
    3,
  );
  const highlightExponent = clampNumber(
    1 - settings.toneStrength * settings.highlights,
    0.15,
    3,
  );

  if (input <= mid) {
    return Math.pow(input / mid, shadowExponent) * mid;
  }

  return (
    mid + Math.pow((input - mid) / (1 - mid), highlightExponent) * (1 - mid)
  );
}

function getToneCurvePath(settings: EpdImageAdjustmentSettings) {
  const points = Array.from({ length: 33 }, (_, index) => {
    const x = index / 32;
    const y = clampNumber(toneCurveValue(x, settings), 0, 1);
    return `${(x * 100).toFixed(2)},${((1 - y) * 100).toFixed(2)}`;
  });

  return `M ${points.join(" L ")}`;
}

function ToneCurvePreview({
  histogram,
  settings,
  onMidpointChange,
}: {
  histogram: number[];
  settings: EpdImageAdjustmentSettings;
  onMidpointChange: (value: number) => void;
}) {
  const midpoint = clampNumber(settings.toneMidpoint, 0.01, 0.99);
  const midpointPercent = midpoint * 100;
  const midtoneOutput =
    (1 - clampNumber(toneCurveValue(settings.toneMidpoint, settings), 0, 1)) *
    100;
  const histogramBarWidth = histogram.length ? 100 / histogram.length : 0;
  const setMidpointFromPointer = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const { left, width } = event.currentTarget.getBoundingClientRect();
      if (!width) return;

      const next = clampNumber((event.clientX - left) / width, 0.01, 0.99);
      onMidpointChange(Math.round(next * 100) / 100);
    },
    [onMidpointChange],
  );
  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setMidpointFromPointer(event);
    },
    [setMidpointFromPointer],
  );
  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.buttons !== 1) return;
      setMidpointFromPointer(event);
    },
    [setMidpointFromPointer],
  );
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const largeStep = 0.05;
      const smallStep = 0.01;
      const nextByKey: Partial<Record<string, number>> = {
        ArrowDown: midpoint - smallStep,
        ArrowLeft: midpoint - smallStep,
        ArrowRight: midpoint + smallStep,
        ArrowUp: midpoint + smallStep,
        PageDown: midpoint - largeStep,
        PageUp: midpoint + largeStep,
        Home: 0.01,
        End: 0.99,
      };
      const next = nextByKey[event.key];

      if (next === undefined) return;
      event.preventDefault();
      onMidpointChange(clampNumber(Math.round(next * 100) / 100, 0.01, 0.99));
    },
    [midpoint, onMidpointChange],
  );

  return (
    <div className={styles.toneCurvePanel}>
      <svg
        className={styles.toneCurveGraph}
        viewBox="0 0 100 100"
        role="slider"
        tabIndex={0}
        aria-label="Tone curve midpoint"
        aria-valuemin={0.01}
        aria-valuemax={0.99}
        aria-valuenow={Number(midpoint.toFixed(2))}
        aria-valuetext={`${Math.round(midpointPercent)}%`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="tone-curve-grid"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 25 0 L 0 0 0 25" className={styles.toneCurveGridLine} />
          </pattern>
        </defs>
        <rect width="100" height="100" className={styles.toneCurveBackground} />
        {histogram.length > 0 &&
          histogram.map((value, index) => {
            const height = value * 72;
            return (
              <rect
                key={index}
                x={index * histogramBarWidth}
                y={100 - height}
                width={histogramBarWidth}
                height={height}
                className={styles.toneCurveHistogramBar}
              />
            );
          })}
        <rect width="100" height="100" fill="url(#tone-curve-grid)" />
        <path d="M 0 100 L 100 0" className={styles.toneCurveReference} />
        <line
          x1={midpointPercent}
          y1="0"
          x2={midpointPercent}
          y2="100"
          className={styles.toneCurveMidpoint}
        />
        <path d={getToneCurvePath(settings)} className={styles.toneCurveLine} />
        <ellipse
          cx={midpointPercent}
          cy={midtoneOutput}
          rx="1.4"
          ry="2.8"
          className={styles.toneCurvePoint}
        />
      </svg>
      <div className={styles.levelsScale} aria-hidden="true">
        <span>
          <Trans>Shadows</Trans>
        </span>
        <span>
          <Trans>Midtones</Trans>
        </span>
        <span>
          <Trans>Highlights</Trans>
        </span>
      </div>
    </div>
  );
}

// Kept dormant while the toolbar exposes Shadows and Highlights separately.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ToneMappingModal() {
  const { settings, update, sliderUpdate, applyAuto, reset } =
    useImageAdjustmentSettings();
  const histogram = useToneHistogram();
  const updateMidpoint = React.useCallback(
    (value: number) => {
      update("toneMidpoint", value);
    },
    [update],
  );

  return (
    <div className={styles.controls}>
      <div className={styles.tonePreviewRow}>
        <div className={styles.toneActions}>
          <Button
            kind="secondary"
            onClick={reset}
            icon={<FontAwesomeIcon icon={faRotate} />}
          >
            <Trans>Reset</Trans>
          </Button>
          <Button
            kind="secondary"
            onClick={applyAuto}
            icon={<FontAwesomeIcon icon={faWandMagicSparkles} />}
          >
            <Trans>Auto</Trans>
          </Button>
        </div>
        <ToneCurvePreview
          histogram={histogram}
          settings={settings}
          onMidpointChange={updateMidpoint}
        />
      </div>
      <div className={styles.toneSliders}>
        <ValueChanger
          minimal
          min={0}
          max={2}
          step={0.05}
          value={settings.toneStrength}
          defaultPoint={0.8}
          onChange={sliderUpdate("toneStrength")}
        >
          <Trans>Strength</Trans>
        </ValueChanger>
        <ValueChanger
          minimal
          min={-1}
          max={1}
          step={0.05}
          value={settings.shadows}
          defaultPoint={0}
          onChange={sliderUpdate("shadows")}
        >
          <Trans>Shadows</Trans>
        </ValueChanger>
        <ValueChanger
          minimal
          min={-1}
          max={1}
          step={0.05}
          value={settings.highlights}
          defaultPoint={0}
          onChange={sliderUpdate("highlights")}
        >
          <Trans>Highlights</Trans>
        </ValueChanger>
        <ValueChanger
          minimal
          min={0}
          max={1}
          step={0.01}
          value={settings.toneMidpoint}
          defaultPoint={0.5}
          onChange={sliderUpdate("toneMidpoint")}
        >
          <Trans>Midtones</Trans>
        </ValueChanger>
      </div>
    </div>
  );
}

function DynamicRangeModal() {
  const { settings, update, sliderUpdate } = useImageAdjustmentSettings();
  const disabled = settings.dynamicRangeCompressionMode === "off";
  const updateLowPercentile = React.useCallback(
    (value: number) => {
      update(
        "dynamicRangeCompressionLowPercentile",
        clampRatio(
          value,
          0,
          settings.dynamicRangeCompressionHighPercentile - 0.01,
        ),
      );
    },
    [settings.dynamicRangeCompressionHighPercentile, update],
  );
  const updateHighPercentile = React.useCallback(
    (value: number) => {
      update(
        "dynamicRangeCompressionHighPercentile",
        clampRatio(
          value,
          settings.dynamicRangeCompressionLowPercentile + 0.01,
          1,
        ),
      );
    },
    [settings.dynamicRangeCompressionLowPercentile, update],
  );

  return (
    <div className={styles.controls}>
      <div className={styles.levelsLayout}>
        <Select
          labelText={<Trans>Mode</Trans>}
          value={settings.dynamicRangeCompressionMode}
          onChange={(event) =>
            update(
              "dynamicRangeCompressionMode",
              event.target
                .value as EpdImageAdjustmentSettings["dynamicRangeCompressionMode"],
            )
          }
        >
          {dynamicRangeCompressionModes.map((mode) => (
            <SelectItem key={mode} value={mode} text={title(mode)} />
          ))}
        </Select>
        <ValueChanger
          min={0}
          max={1}
          step={0.05}
          value={settings.dynamicRangeCompressionStrength}
          defaultPoint={1}
          disabled={disabled}
          onChange={sliderUpdate("dynamicRangeCompressionStrength")}
        >
          <Trans>Strength</Trans>
        </ValueChanger>
        {settings.dynamicRangeCompressionMode === "auto" && (
          <PercentileRange
            low={settings.dynamicRangeCompressionLowPercentile}
            high={settings.dynamicRangeCompressionHighPercentile}
            onLowChange={updateLowPercentile}
            onHighChange={updateHighPercentile}
          />
        )}
      </div>
    </div>
  );
}

interface PercentileRangeProps {
  low: number;
  high: number;
  disabled?: boolean;
  onLowChange: (value: number) => void;
  onHighChange: (value: number) => void;
}

function PercentileRange({
  low,
  high,
  disabled,
  onLowChange,
  onHighChange,
}: PercentileRangeProps) {
  const lowPercent = Math.round(low * 100);
  const highPercent = Math.round(high * 100);

  const handleLowChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onLowChange(
      clampRatio(parseFloat(event.target.value) / 100, 0, high - 0.01),
    );
  };

  const handleHighChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onHighChange(
      clampRatio(parseFloat(event.target.value) / 100, low + 0.01, 1),
    );
  };

  return (
    <div className={styles.levelsRangeControl}>
      <div className={styles.levelsRangeHeader}>
        <span>
          <Trans>Source range</Trans>
        </span>
        <output aria-live="polite">
          {lowPercent}% / {highPercent}%
        </output>
      </div>

      <div
        className={styles.levelsRange}
        style={
          {
            "--black-percent": `${lowPercent}%`,
            "--white-percent": `${highPercent}%`,
          } as React.CSSProperties
        }
      >
        <div
          className={`${styles.levelsTrack} ${styles.percentileTrack}`}
          aria-hidden="true"
        >
          <span className={styles.levelsSelection} />
          <span className={styles.levelsHandleBlack} />
          <span className={styles.levelsHandleWhite} />
        </div>
        <input
          type="range"
          min={0}
          max={99}
          step={1}
          value={lowPercent}
          disabled={disabled}
          onChange={handleLowChange}
          aria-label="Shadow clip"
          className={styles.levelsInput}
        />
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={highPercent}
          disabled={disabled}
          onChange={handleHighChange}
          aria-label="Highlight clip"
          className={styles.levelsInput}
        />
      </div>

      <div className={styles.levelsScale} aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      <div className={styles.levelsFields}>
        <label>
          <span>
            <Trans>Shadow clip</Trans>
          </span>
          <input
            type="number"
            min={0}
            max={99}
            step={1}
            value={lowPercent}
            disabled={disabled}
            onChange={handleLowChange}
          />
        </label>
        <label>
          <span>
            <Trans>Highlight clip</Trans>
          </span>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={highPercent}
            disabled={disabled}
            onChange={handleHighChange}
          />
        </label>
      </div>
    </div>
  );
}

interface LevelsRangeProps {
  black: number;
  white: number;
  disabled?: boolean;
  onBlackChange: (value: number) => void;
  onWhiteChange: (value: number) => void;
}

function LevelsRange({
  black,
  white,
  disabled,
  onBlackChange,
  onWhiteChange,
}: LevelsRangeProps) {
  const blackPercent = (black / 255) * 100;
  const whitePercent = (white / 255) * 100;

  const handleBlackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onBlackChange(clampLevel(parseFloat(event.target.value), 0, white - 1));
  };

  const handleWhiteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onWhiteChange(clampLevel(parseFloat(event.target.value), black + 1, 255));
  };

  return (
    <div className={styles.levelsRangeControl}>
      <div className={styles.levelsRangeHeader}>
        <span>
          <Trans>Output levels</Trans>
        </span>
        <output aria-live="polite">
          {black} / {white}
        </output>
      </div>

      <div
        className={styles.levelsRange}
        style={
          {
            "--black-percent": `${blackPercent}%`,
            "--white-percent": `${whitePercent}%`,
          } as React.CSSProperties
        }
      >
        <div className={styles.levelsTrack} aria-hidden="true">
          <span className={styles.levelsSelection} />
          <span className={styles.levelsHandleBlack} />
          <span className={styles.levelsHandleWhite} />
        </div>
        <input
          type="range"
          min={0}
          max={254}
          step={1}
          value={black}
          disabled={disabled}
          onChange={handleBlackChange}
          aria-label="Black point"
          className={styles.levelsInput}
        />
        <input
          type="range"
          min={1}
          max={255}
          step={1}
          value={white}
          disabled={disabled}
          onChange={handleWhiteChange}
          aria-label="White point"
          className={styles.levelsInput}
        />
      </div>

      <div className={styles.levelsScale} aria-hidden="true">
        <span>0</span>
        <span>128</span>
        <span>255</span>
      </div>

      {/* <div className={styles.levelsFields}>
        <label>
          <span>
            <Trans>Black point</Trans>
          </span>
          <input
            type="number"
            min={0}
            max={254}
            step={1}
            value={black}
            disabled={disabled}
            onChange={handleBlackChange}
          />
        </label>
        <label>
          <span>
            <Trans>White point</Trans>
          </span>
          <input
            type="number"
            min={1}
            max={255}
            step={1}
            value={white}
            disabled={disabled}
            onChange={handleWhiteChange}
          />
        </label>
      </div> */}
    </div>
  );
}

// Hidden for now, but left intact so saved level filters can still serialize.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LevelCompressionModal() {
  const { settings, update, sliderUpdate } = useImageAdjustmentSettings();
  const disabled = settings.levelCompressionMode === "off";
  const updateBlack = React.useCallback(
    (value: number) => {
      update(
        "levelCompressionBlack",
        clampLevel(value, 0, settings.levelCompressionWhite - 1),
      );
    },
    [settings.levelCompressionWhite, update],
  );
  const updateWhite = React.useCallback(
    (value: number) => {
      update(
        "levelCompressionWhite",
        clampLevel(value, settings.levelCompressionBlack + 1, 255),
      );
    },
    [settings.levelCompressionBlack, update],
  );

  return (
    <div className={styles.controls}>
      <div className={styles.levelsLayout}>
        <Select
          labelText={<Trans>Mode</Trans>}
          value={settings.levelCompressionMode}
          onChange={(event) =>
            update(
              "levelCompressionMode",
              event.target
                .value as EpdImageAdjustmentSettings["levelCompressionMode"],
            )
          }
        >
          {levelCompressionModes.map((mode) => (
            <SelectItem key={mode} value={mode} text={title(mode)} />
          ))}
        </Select>
        <Checkbox
          id="image-adjustments-auto-levels"
          name="image-adjustments-auto-levels"
          labelText={<Trans>Auto</Trans>}
          checked={settings.levelCompressionAuto}
          disabled={disabled}
          onChange={(_event, checked) =>
            update("levelCompressionAuto", Boolean(checked))
          }
        />
        <LevelsRange
          black={settings.levelCompressionBlack}
          white={settings.levelCompressionWhite}
          disabled={disabled}
          onBlackChange={updateBlack}
          onWhiteChange={updateWhite}
        />
        {settings.levelCompressionAuto && !disabled && (
          <ValueChanger
            min={0}
            max={1}
            step={0.01}
            value={settings.levelCompressionAutoThreshold}
            defaultPoint={0.01}
            onChange={sliderUpdate("levelCompressionAutoThreshold")}
          >
            <Trans>Clip tolerance</Trans>
          </ValueChanger>
        )}
      </div>
    </div>
  );
}

function AutoAdjustmentsButton() {
  const { applyAuto } = useImageAdjustmentSettings();

  return (
    <EditorButton
      id="image-adjustments-auto"
      kind="secondary"
      text={<Trans>Auto</Trans>}
      icon={<FontAwesomeIcon icon={faWandMagicSparkles} />}
      onClick={applyAuto}
    />
  );
}

export default function ImageAdjustments() {
  const { fabricRef }: any = useImageEditorContext();

  useEffect(() => {
    registerEpdImageAdjustmentsIfNeeded();
    useCanvas2dFilterBackend();
  }, [fabricRef]);

  return (
    <>
      <AutoAdjustmentsButton />
      <EditorButton
        id="image-adjustments-exposure"
        kind="secondary"
        text={<Trans>Exposure</Trans>}
        icon={<FontAwesomeIcon icon={faSun} />}
        modalKind="slider"
        modalComponent={() => (
          <SingleValueModal
            settingKey="exposure"
            min={-1}
            max={1}
            step={0.05}
            defaultPoint={0}
          >
            <Trans>Exposure</Trans>
          </SingleValueModal>
        )}
      />
      <EditorButton
        id="image-adjustments-saturation"
        kind="secondary"
        text={<Trans>Saturation</Trans>}
        icon={<FontAwesomeIcon icon={faTint} />}
        modalKind="slider"
        modalComponent={() => (
          <SingleValueModal
            settingKey="saturation"
            min={-1}
            max={1}
            step={0.05}
            defaultPoint={0}
          >
            <Trans>Saturation</Trans>
          </SingleValueModal>
        )}
      />
      <EditorButton
        id="image-adjustments-contrast"
        kind="secondary"
        text={<Trans>Contrast</Trans>}
        icon={<FontAwesomeIcon icon={faCircleHalfStroke} />}
        modalKind="slider"
        modalComponent={() => (
          <SingleValueModal
            settingKey="contrast"
            min={-1}
            max={1}
            step={0.05}
            defaultPoint={0}
          >
            <Trans>Contrast</Trans>
          </SingleValueModal>
        )}
      />
      <Clarity />
      <EditorButton
        id="image-adjustments-shadows"
        kind="secondary"
        text={<Trans>Shadows</Trans>}
        icon={<FontAwesomeIcon icon={faMoon} />}
        modalKind="slider"
        modalComponent={() => (
          <SingleValueModal
            settingKey="shadows"
            min={-1}
            max={1}
            step={0.05}
            defaultPoint={0}
          >
            <Trans>Shadows</Trans>
          </SingleValueModal>
        )}
      />
      <EditorButton
        id="image-adjustments-highlights"
        kind="secondary"
        text={<Trans>Highlights</Trans>}
        icon={<FontAwesomeIcon icon={faSunBright} />}
        modalKind="slider"
        modalComponent={() => (
          <SingleValueModal
            settingKey="highlights"
            min={-1}
            max={1}
            step={0.05}
            defaultPoint={0}
          >
            <Trans>Highlights</Trans>
          </SingleValueModal>
        )}
      />
      <EditorButton
        id="image-adjustments-dynamic-range"
        kind="secondary"
        text={<Trans>Dynamic range</Trans>}
        icon={<FontAwesomeIcon icon={faArrowsLeftRightToLine} />}
        modalComponent={DynamicRangeModal}
        modalKind="slider"
        modalHeading={<Trans>Dynamic range</Trans>}
        modalProps={{
          primaryButtonText: <Trans>Done</Trans>,
        }}
      />
      {/* Levels is intentionally hidden while the new adjustment controls settle. */}
      {/* <EditorButton
        id="image-adjustments-level-compression"
        kind="secondary"
        text={<Trans>Levels</Trans>}
        icon={<FontAwesomeIcon icon={faSliders} />}
        modalComponent={LevelCompressionModal}
        modalKind="slider"
        modalHeading={<Trans>Levels</Trans>}
        modalProps={{
          primaryButtonText: <Trans>Done</Trans>,
        }}
      /> */}
    </>
  );
}
