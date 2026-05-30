import {
  faCircleHalfStroke,
  faSliders,
  faSun,
  faWandMagicSparkles,
} from "@fortawesome/pro-regular-svg-icons";
import { faRotate, faTint } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Checkbox, Select, SelectItem } from "@progressiveui/react";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import {
  aitjcizeSpectra6Palette,
  suggestCanvasProcessingOptions,
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

const dynamicRangeCompressionModes: EpdImageAdjustmentSettings["dynamicRangeCompressionMode"][] =
  ["off", "display", "auto"];
const levelCompressionModes: EpdImageAdjustmentSettings["levelCompressionMode"][] =
  ["off", "perChannel", "luma"];

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

function useImageAdjustmentSettings() {
  const { fabricRef }: any = useImageEditorContext();
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

      useCanvas2dFilterBackend();
      applySettingsToImage(img, next);
      fabricRef.current?.requestRenderAll?.();
    },
    [fabricRef],
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
    const suggestion = suggestCanvasProcessingOptions(
      sourceCanvas,
      aitjcizeSpectra6Palette,
    );
    updateSettings(settingsFromDitherOptions(suggestion.ditherOptions));
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
    "strength" | "shadowBoost" | "highlightCompress" | "midpoint"
  >,
) {
  if (settings.strength === 0) return input;
  const mid = clampNumber(settings.midpoint, 0.01, 0.99);

  if (input <= mid) {
    return (
      Math.pow(
        input / mid,
        1 - settings.strength * settings.shadowBoost,
      ) * mid
    );
  }

  return (
    mid +
    Math.pow(
      (input - mid) / (1 - mid),
      1 + settings.strength * settings.highlightCompress,
    ) *
      (1 - mid)
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

function ToneCurvePreview({ settings }: { settings: EpdImageAdjustmentSettings }) {
  const midpointPercent = clampNumber(settings.midpoint, 0.01, 0.99) * 100;
  const midtoneOutput =
    (1 - clampNumber(toneCurveValue(settings.midpoint, settings), 0, 1)) * 100;

  return (
    <div className={styles.toneCurvePanel}>
      <div className={styles.levelsRangeHeader}>
        <span>
          <Trans>Tone curve</Trans>
        </span>
        <output aria-live="polite">
          {settings.strength.toFixed(2)}
        </output>
      </div>
      <svg
        className={styles.toneCurveGraph}
        viewBox="0 0 100 100"
        role="img"
        aria-label="Tone curve preview"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="tone-curve-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" className={styles.toneCurveGridLine} />
          </pattern>
        </defs>
        <rect width="100" height="100" className={styles.toneCurveBackground} />
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
        <circle
          cx={midpointPercent}
          cy={midtoneOutput}
          r="2.8"
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

interface ToneSliderProps {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultPoint: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function ToneSlider({
  label,
  value,
  min,
  max,
  step,
  defaultPoint,
  onChange,
}: ToneSliderProps) {
  const range = max - min || 1;
  const valuePercent = ((value - min) / range) * 100;
  const defaultPercent = ((defaultPoint - min) / range) * 100;

  return (
    <label className={styles.toneSlider}>
      <span className={styles.toneSliderHeader}>
        <span>{label}</span>
        <output>{value.toFixed(2)}</output>
      </span>
      <span
        className={styles.toneSliderTrack}
        style={
          {
            "--value-percent": `${valuePercent}%`,
            "--default-percent": `${defaultPercent}%`,
          } as React.CSSProperties
        }
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className={styles.toneSliderInput}
        />
      </span>
    </label>
  );
}

function ToneMappingModal() {
  const { settings, sliderUpdate, applyAuto, reset } =
    useImageAdjustmentSettings();

  return (
    <div className={styles.controls}>
      <div className={styles.toneActions}>
        <Button kind="secondary" onClick={reset} icon={<FontAwesomeIcon icon={faRotate} />}>
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
      <ToneCurvePreview settings={settings} />
      <div className={styles.toneSliders}>
        <ToneSlider
          label={<Trans>Curve strength</Trans>}
          min={0}
          max={2}
          step={0.05}
          value={settings.strength}
          defaultPoint={0}
          onChange={sliderUpdate("strength")}
        />
        <ToneSlider
          label={<Trans>Shadow lift</Trans>}
          min={0}
          max={1}
          step={0.05}
          value={settings.shadowBoost}
          defaultPoint={0}
          onChange={sliderUpdate("shadowBoost")}
        />
        <ToneSlider
          label={<Trans>Highlight rolloff</Trans>}
          min={0}
          max={3}
          step={0.05}
          value={settings.highlightCompress}
          defaultPoint={1.5}
          onChange={sliderUpdate("highlightCompress")}
        />
        <ToneSlider
          label={<Trans>Midpoint</Trans>}
          min={0}
          max={1}
          step={0.05}
          value={settings.midpoint}
          defaultPoint={0.5}
          onChange={sliderUpdate("midpoint")}
        />
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
        clampRatio(value, 0, settings.dynamicRangeCompressionHighPercentile - 0.01),
      );
    },
    [settings.dynamicRangeCompressionHighPercentile, update],
  );
  const updateHighPercentile = React.useCallback(
    (value: number) => {
      update(
        "dynamicRangeCompressionHighPercentile",
        clampRatio(value, settings.dynamicRangeCompressionLowPercentile + 0.01, 1),
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
    onLowChange(clampRatio(parseFloat(event.target.value) / 100, 0, high - 0.01));
  };

  const handleHighChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onHighChange(clampRatio(parseFloat(event.target.value) / 100, low + 0.01, 1));
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

      <div className={styles.levelsFields}>
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
      </div>
    </div>
  );
}

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
            min={0}
            max={3}
            step={0.05}
            defaultPoint={1}
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
            min={0}
            max={4}
            step={0.05}
            defaultPoint={1}
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
            min={0}
            max={4}
            step={0.05}
            defaultPoint={1}
          >
            <Trans>Contrast</Trans>
          </SingleValueModal>
        )}
      />
      <EditorButton
        id="image-adjustments-tone-mapping"
        kind="secondary"
        text={<Trans>Tone mapping</Trans>}
        icon={<FontAwesomeIcon icon={faSliders} />}
        modalComponent={ToneMappingModal}
        modalHeading={<Trans>Tone mapping</Trans>}
        modalProps={{
          primaryButtonText: <Trans>Done</Trans>,
        }}
      />
      <EditorButton
        id="image-adjustments-dynamic-range"
        kind="secondary"
        text={<Trans>Dynamic range</Trans>}
        icon={<FontAwesomeIcon icon={faSliders} />}
        modalComponent={DynamicRangeModal}
        modalHeading={<Trans>Dynamic range</Trans>}
        modalProps={{
          primaryButtonText: <Trans>Done</Trans>,
        }}
      />
      <EditorButton
        id="image-adjustments-level-compression"
        kind="secondary"
        text={<Trans>Levels</Trans>}
        icon={<FontAwesomeIcon icon={faSliders} />}
        modalComponent={LevelCompressionModal}
        modalHeading={<Trans>Levels</Trans>}
        modalProps={{
          primaryButtonText: <Trans>Done</Trans>,
        }}
      />
    </>
  );
}
