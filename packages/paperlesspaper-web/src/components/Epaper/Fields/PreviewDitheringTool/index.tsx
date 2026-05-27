import React from "react";
import {
  Button,
  Checkbox,
  NumberInput,
  Select,
  SelectItem,
} from "@progressiveui/react";
import { Trans } from "react-i18next";
import styles from "./previewDitheringTool.module.scss";
import {
  applyDitherOptionsToPreviewSettings,
  DEFAULT_PREVIEW_DITHERING_SETTINGS,
  getPreviewSuggestionSettingsSource,
} from "./options";
import type {
  PreviewDitheringDebugInfo,
  PreviewDitheringSettings,
} from "./types";

type PreviewDitheringToolProps = {
  settings: PreviewDitheringSettings;
  debugInfo?: PreviewDitheringDebugInfo | null;
  isDebug?: boolean;
  isRefreshing?: boolean;
  className?: string;
  onChange: (settings: PreviewDitheringSettings) => void;
  onRefreshPreview: () => void | Promise<void>;
};

const autoIntents = ["natural", "vivid", "readable", "faithful", "lowNoise"];
const processingPresets = [
  "none",
  "balanced",
  "dynamic",
  "vivid",
  "soft",
  "grayscale",
];
const ditheringTypes = [
  "errorDiffusion",
  "ordered",
  "random",
  "quantizationOnly",
];
const errorDiffusionMatrices = [
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
const colorMatchingModes = ["rgb", "lab"];
const toneMappingModes = ["off", "contrast", "scurve"];
const dynamicRangeCompressionModes = ["off", "display", "auto"];
const levelCompressionModes = ["off", "perChannel", "luma"];
const orderedMatrixSizes = [2, 3, 4, 6, 8];

function title(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export default function PreviewDitheringTool({
  settings,
  debugInfo,
  isDebug,
  isRefreshing,
  className,
  onChange,
  onRefreshPreview,
}: PreviewDitheringToolProps) {
  const update = <K extends keyof PreviewDitheringSettings>(
    key: K,
    value: PreviewDitheringSettings[K],
    {
      markAutoEdited = true,
      resetAutoSource = false,
    }: {
      markAutoEdited?: boolean;
      resetAutoSource?: boolean;
    } = {},
  ) => {
    onChange({
      ...settings,
      [key]: value,
      autoSettingsEdited:
        settings.useAutoProcessing && markAutoEdited
          ? true
          : settings.autoSettingsEdited,
      autoSettingsSource: resetAutoSource
        ? undefined
        : settings.autoSettingsSource,
    });
  };

  const numberUpdate =
    <K extends keyof PreviewDitheringSettings>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      update(
        key,
        (Number.isNaN(value) ? 0 : value) as PreviewDitheringSettings[K],
      );
    };

  const checkboxUpdate =
    <K extends keyof PreviewDitheringSettings>(key: K) =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked?: boolean) => {
      update(key, Boolean(checked) as PreviewDitheringSettings[K]);
    };

  const resetSettings = () => {
    if (settings.useAutoProcessing && debugInfo?.suggestion) {
      onChange(
        applyDitherOptionsToPreviewSettings({
          settings,
          options: debugInfo.suggestion.ditherOptions,
          source: getPreviewSuggestionSettingsSource(debugInfo.suggestion),
        }),
      );
      return;
    }

    onChange({
      ...DEFAULT_PREVIEW_DITHERING_SETTINGS,
      useAutoProcessing: settings.useAutoProcessing,
      autoIntent: settings.autoIntent,
      autoSettingsEdited: false,
    });
  };

  const autoOptions = debugInfo?.suggestion?.ditherOptions;
  const autoScores = debugInfo?.suggestion?.scores
    ? Object.entries(debugInfo.suggestion.scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <div className={`${styles.tool} ${className || ""}`}>
      <div className={styles.header}>
        <h3>
          <Trans>Dithering</Trans>
        </h3>
        <Button onClick={onRefreshPreview} disabled={isRefreshing}>
          {isRefreshing ? <Trans>Applying...</Trans> : <Trans>Refresh</Trans>}
        </Button>
        <Button kind="secondary" onClick={resetSettings} disabled={isRefreshing}>
          <Trans>Reset</Trans>
        </Button>
      </div>

      <div className={styles.grid}>
        <Checkbox
          id="preview-dithering-auto-processing"
          name="preview-dithering-auto-processing"
          labelText={<Trans>Auto processing</Trans>}
          checked={settings.useAutoProcessing}
          onChange={(_event, checked) =>
            onChange({
              ...settings,
              useAutoProcessing: Boolean(checked),
              autoSettingsEdited: false,
              autoSettingsSource: undefined,
            })
          }
        />

        <Select
          labelText={<Trans>Auto intent</Trans>}
          value={settings.autoIntent}
          disabled={!settings.useAutoProcessing}
          onChange={(event) =>
            update(
              "autoIntent",
              event.target.value as PreviewDitheringSettings["autoIntent"],
              {
                markAutoEdited: false,
                resetAutoSource: true,
              },
            )
          }
        >
          {autoIntents.map((intent) => (
            <SelectItem key={intent} value={intent} text={title(intent)} />
          ))}
        </Select>
      </div>

      {settings.useAutoProcessing && debugInfo?.suggestion && (
        <div className={styles.autoDecision}>
          <h4>
            <Trans>Auto decision</Trans>
          </h4>
          <dl>
            <div>
              <dt>
                <Trans>Image kind</Trans>
              </dt>
              <dd>{title(debugInfo.suggestion.imageKind)}</dd>
            </div>
            <div>
              <dt>
                <Trans>Intent</Trans>
              </dt>
              <dd>{title(debugInfo.suggestion.intent)}</dd>
            </div>
            {autoOptions?.processingPreset && (
              <div>
                <dt>
                  <Trans>Preset</Trans>
                </dt>
                <dd>{title(String(autoOptions.processingPreset))}</dd>
              </div>
            )}
            {autoOptions?.ditheringType && (
              <div>
                <dt>
                  <Trans>Dithering</Trans>
                </dt>
                <dd>{title(String(autoOptions.ditheringType))}</dd>
              </div>
            )}
            {autoOptions?.errorDiffusionMatrix && (
              <div>
                <dt>
                  <Trans>Diffusion</Trans>
                </dt>
                <dd>{title(String(autoOptions.errorDiffusionMatrix))}</dd>
              </div>
            )}
            {autoOptions?.colorMatching && (
              <div>
                <dt>
                  <Trans>Matching</Trans>
                </dt>
                <dd>{String(autoOptions.colorMatching).toUpperCase()}</dd>
              </div>
            )}
          </dl>
          {debugInfo.suggestion.reasons.length > 0 && (
            <ul>
              {debugInfo.suggestion.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {autoScores.length > 0 && (
            <div className={styles.scoreRow}>
              {autoScores.map(([name, score]) => (
                <span key={name}>
                  {title(name)} {Math.round(score)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <fieldset className={styles.section}>
        <legend>
          <Trans>Processing</Trans>
        </legend>
        <div className={styles.grid}>
          <Select
            labelText={<Trans>Preset</Trans>}
            value={settings.processingPreset}
            onChange={(event) =>
              update(
                "processingPreset",
                event.target
                  .value as PreviewDitheringSettings["processingPreset"],
              )
            }
          >
            {processingPresets.map((preset) => (
              <SelectItem key={preset} value={preset} text={title(preset)} />
            ))}
          </Select>

          <Select
            labelText={<Trans>Color matching</Trans>}
            value={settings.colorMatching}
            onChange={(event) =>
              update(
                "colorMatching",
                event.target.value as PreviewDitheringSettings["colorMatching"],
              )
            }
          >
            {colorMatchingModes.map((mode) => (
              <SelectItem key={mode} value={mode} text={mode.toUpperCase()} />
            ))}
          </Select>

          <Select
            labelText={<Trans>Dithering type</Trans>}
            value={settings.ditheringType}
            onChange={(event) =>
              update(
                "ditheringType",
                event.target.value as PreviewDitheringSettings["ditheringType"],
              )
            }
          >
            {ditheringTypes.map((type) => (
              <SelectItem key={type} value={type} text={title(type)} />
            ))}
          </Select>

          <Select
            labelText={<Trans>Error diffusion</Trans>}
            value={settings.errorDiffusionMatrix}
            disabled={settings.ditheringType !== "errorDiffusion"}
            onChange={(event) =>
              update(
                "errorDiffusionMatrix",
                event.target
                  .value as PreviewDitheringSettings["errorDiffusionMatrix"],
              )
            }
          >
            {errorDiffusionMatrices.map((matrix) => (
              <SelectItem key={matrix} value={matrix} text={title(matrix)} />
            ))}
          </Select>

          <Checkbox
            id="preview-dithering-serpentine"
            name="preview-dithering-serpentine"
            labelText={<Trans>Serpentine</Trans>}
            checked={settings.serpentine}
            disabled={settings.ditheringType !== "errorDiffusion"}
            onChange={checkboxUpdate("serpentine")}
          />

          <Select
            labelText={<Trans>Ordered matrix</Trans>}
            value={String(settings.orderedDitheringMatrixSize)}
            disabled={settings.ditheringType !== "ordered"}
            onChange={(event) =>
              update("orderedDitheringMatrixSize", Number(event.target.value))
            }
          >
            {orderedMatrixSizes.map((size) => (
              <SelectItem
                key={size}
                value={String(size)}
                text={`${size} x ${size}`}
              />
            ))}
          </Select>

          <Select
            labelText={<Trans>Random mode</Trans>}
            value={settings.randomDitheringType}
            disabled={settings.ditheringType !== "random"}
            onChange={(event) =>
              update(
                "randomDitheringType",
                event.target
                  .value as PreviewDitheringSettings["randomDitheringType"],
              )
            }
          >
            <SelectItem value="blackAndWhite" text="Black and white" />
            <SelectItem value="rgb" text="RGB" />
          </Select>
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>
          <Trans>Tone mapping</Trans>
        </legend>
        <div className={styles.grid}>
          <Select
            labelText={<Trans>Mode</Trans>}
            value={settings.toneMappingMode}
            onChange={(event) =>
              update(
                "toneMappingMode",
                event.target
                  .value as PreviewDitheringSettings["toneMappingMode"],
              )
            }
          >
            {toneMappingModes.map((mode) => (
              <SelectItem key={mode} value={mode} text={title(mode)} />
            ))}
          </Select>

          <NumberInput
            labelText={<Trans>Exposure</Trans>}
            min={0}
            max={3}
            step={0.05}
            value={settings.exposure}
            onChange={numberUpdate("exposure")}
          />
          <NumberInput
            labelText={<Trans>Saturation</Trans>}
            min={0}
            max={4}
            step={0.05}
            value={settings.saturation}
            onChange={numberUpdate("saturation")}
          />
          <NumberInput
            labelText={<Trans>Contrast</Trans>}
            min={0}
            max={4}
            step={0.05}
            value={settings.contrast}
            disabled={settings.toneMappingMode !== "contrast"}
            onChange={numberUpdate("contrast")}
          />
          <NumberInput
            labelText={<Trans>S-curve strength</Trans>}
            min={0}
            max={2}
            step={0.05}
            value={settings.strength}
            disabled={settings.toneMappingMode !== "scurve"}
            onChange={numberUpdate("strength")}
          />
          <NumberInput
            labelText={<Trans>Shadow boost</Trans>}
            min={0}
            max={1}
            step={0.05}
            value={settings.shadowBoost}
            disabled={settings.toneMappingMode !== "scurve"}
            onChange={numberUpdate("shadowBoost")}
          />
          <NumberInput
            labelText={<Trans>Highlight compress</Trans>}
            min={0}
            max={3}
            step={0.05}
            value={settings.highlightCompress}
            disabled={settings.toneMappingMode !== "scurve"}
            onChange={numberUpdate("highlightCompress")}
          />
          <NumberInput
            labelText={<Trans>Midpoint</Trans>}
            min={0}
            max={1}
            step={0.05}
            value={settings.midpoint}
            disabled={settings.toneMappingMode !== "scurve"}
            onChange={numberUpdate("midpoint")}
          />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>
          <Trans>Dynamic range</Trans>
        </legend>
        <div className={styles.grid}>
          <Select
            labelText={<Trans>Mode</Trans>}
            value={settings.dynamicRangeCompressionMode}
            onChange={(event) =>
              update(
                "dynamicRangeCompressionMode",
                event.target
                  .value as PreviewDitheringSettings["dynamicRangeCompressionMode"],
              )
            }
          >
            {dynamicRangeCompressionModes.map((mode) => (
              <SelectItem key={mode} value={mode} text={title(mode)} />
            ))}
          </Select>

          <NumberInput
            labelText={<Trans>Strength</Trans>}
            min={0}
            max={1}
            step={0.05}
            value={settings.dynamicRangeCompressionStrength}
            disabled={settings.dynamicRangeCompressionMode === "off"}
            onChange={numberUpdate("dynamicRangeCompressionStrength")}
          />
          <NumberInput
            labelText={<Trans>Low percentile</Trans>}
            min={0}
            max={1}
            step={0.01}
            value={settings.dynamicRangeCompressionLowPercentile}
            disabled={settings.dynamicRangeCompressionMode !== "auto"}
            onChange={numberUpdate("dynamicRangeCompressionLowPercentile")}
          />
          <NumberInput
            labelText={<Trans>High percentile</Trans>}
            min={0}
            max={1}
            step={0.01}
            value={settings.dynamicRangeCompressionHighPercentile}
            disabled={settings.dynamicRangeCompressionMode !== "auto"}
            onChange={numberUpdate("dynamicRangeCompressionHighPercentile")}
          />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>
          <Trans>Level compression</Trans>
        </legend>
        <div className={styles.grid}>
          <Select
            labelText={<Trans>Mode</Trans>}
            value={settings.levelCompressionMode}
            onChange={(event) =>
              update(
                "levelCompressionMode",
                event.target
                  .value as PreviewDitheringSettings["levelCompressionMode"],
              )
            }
          >
            {levelCompressionModes.map((mode) => (
              <SelectItem key={mode} value={mode} text={title(mode)} />
            ))}
          </Select>

          <Checkbox
            id="preview-dithering-auto-levels"
            name="preview-dithering-auto-levels"
            labelText={<Trans>Auto levels</Trans>}
            checked={settings.levelCompressionAuto}
            disabled={settings.levelCompressionMode === "off"}
            onChange={checkboxUpdate("levelCompressionAuto")}
          />

          <NumberInput
            labelText={<Trans>Auto threshold</Trans>}
            min={0}
            max={1}
            step={0.01}
            value={settings.levelCompressionAutoThreshold}
            disabled={
              settings.levelCompressionMode === "off" ||
              !settings.levelCompressionAuto
            }
            onChange={numberUpdate("levelCompressionAutoThreshold")}
          />
          <NumberInput
            labelText={<Trans>Black</Trans>}
            min={0}
            max={255}
            step={1}
            value={settings.levelCompressionBlack}
            disabled={settings.levelCompressionMode === "off"}
            onChange={numberUpdate("levelCompressionBlack")}
          />
          <NumberInput
            labelText={<Trans>White</Trans>}
            min={0}
            max={255}
            step={1}
            value={settings.levelCompressionWhite}
            disabled={settings.levelCompressionMode === "off"}
            onChange={numberUpdate("levelCompressionWhite")}
          />
        </div>
      </fieldset>

      {isDebug && debugInfo && (
        <details className={styles.debug} open>
          <summary>
            <Trans>Debug info</Trans>
          </summary>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
