import React from "react";
import { Button, Checkbox, Select, SelectItem } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
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
const ditheringTypes = [
  "errorDiffusion",
  "ordered",
  "random",
  "quantizationOnly",
  "hueMix",
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
const colorMatchingModes = ["rgb", "lab", "chroma"];
const orderedMatrixSizes = [2, 3, 4, 6, 8];

function title(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function colorMatchingTitle(value: string) {
  return value === "rgb" || value === "lab"
    ? value.toUpperCase()
    : title(value);
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
  const { t } = useTranslation();

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

  const checkboxUpdate =
    <K extends keyof PreviewDitheringSettings>(key: K) =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked?: boolean) => {
      update(key, Boolean(checked) as PreviewDitheringSettings[K]);
    };

  const previewOptionUpdate =
    <K extends keyof PreviewDitheringSettings>(key: K) =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked?: boolean) => {
      update(key, Boolean(checked) as PreviewDitheringSettings[K], {
        markAutoEdited: false,
      });
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
          <Trans>Dithering for Experts</Trans>
        </h3>
        {/* <Button onClick={onRefreshPreview} disabled={isRefreshing}>
          {isRefreshing ? <Trans>Applying...</Trans> : <Trans>Refresh</Trans>}
        </Button>
        <Button
          kind="secondary"
          onClick={resetSettings}
          disabled={isRefreshing}
        >
          <Trans>Reset</Trans>
        </Button> */}
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
            <SelectItem key={intent} value={intent} text={t(title(intent))} />
          ))}
        </Select>
      </div>

      <fieldset className={styles.section}>
        <legend>
          <Trans>Preview performance</Trans>
        </legend>
        <div className={styles.grid}>
          <Checkbox
            id="preview-dithering-fast-analysis"
            name="preview-dithering-fast-analysis"
            labelText={<Trans>Downscale auto analysis</Trans>}
            checked={settings.useFastPreviewAnalysis}
            onChange={previewOptionUpdate("useFastPreviewAnalysis")}
          />

          <Checkbox
            id="preview-dithering-skip-unused-analysis"
            name="preview-dithering-skip-unused-analysis"
            labelText={<Trans>Skip unused auto analysis</Trans>}
            checked={settings.skipUnneededPreviewSuggestions}
            onChange={previewOptionUpdate("skipUnneededPreviewSuggestions")}
          />

          <Checkbox
            id="preview-dithering-blob-preview-images"
            name="preview-dithering-blob-preview-images"
            labelText={<Trans>Use blob preview URLs</Trans>}
            checked={settings.useBlobPreviewImages}
            onChange={previewOptionUpdate("useBlobPreviewImages")}
          />

          <Checkbox
            id="preview-dithering-accelerated-processing"
            name="preview-dithering-accelerated-processing"
            labelText={<Trans>Use accelerated dithering</Trans>}
            checked={settings.useAcceleratedPreviewProcessing}
            onChange={previewOptionUpdate("useAcceleratedPreviewProcessing")}
          />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>
          <Trans>Dither adjustments</Trans>
        </legend>
        <div className={styles.grid}>
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
              <SelectItem
                key={mode}
                value={mode}
                text={t(colorMatchingTitle(mode))}
              />
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
              <SelectItem key={type} value={type} text={t(title(type))} />
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
              <SelectItem key={matrix} value={matrix} text={t(title(matrix))} />
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
            <SelectItem value="blackAndWhite" text={t("Black and white")} />
            <SelectItem value="rgb" text={t("RGB")} />
          </Select>
        </div>
      </fieldset>

      {isDebug && debugInfo && (
        <details className={styles.debug} open>
          <summary>
            <Trans>Debug info</Trans>
          </summary>

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
                  <dd>{t(title(debugInfo.suggestion.imageKind))}</dd>
                </div>
                <div>
                  <dt>
                    <Trans>Intent</Trans>
                  </dt>
                  <dd>{t(title(debugInfo.suggestion.intent))}</dd>
                </div>
                {autoOptions?.ditheringType && (
                  <div>
                    <dt>
                      <Trans>Dithering</Trans>
                    </dt>
                    <dd>{t(title(String(autoOptions.ditheringType)))}</dd>
                  </div>
                )}
                {autoOptions?.errorDiffusionMatrix && (
                  <div>
                    <dt>
                      <Trans>Diffusion</Trans>
                    </dt>
                    <dd>
                      {t(title(String(autoOptions.errorDiffusionMatrix)))}
                    </dd>
                  </div>
                )}
                {autoOptions?.colorMatching && (
                  <div>
                    <dt>
                      <Trans>Matching</Trans>
                    </dt>
                    <dd>
                      {t(colorMatchingTitle(String(autoOptions.colorMatching)))}
                    </dd>
                  </div>
                )}
              </dl>
              {debugInfo.suggestion.reasons.length > 0 && (
                <ul>
                  {debugInfo.suggestion.reasons.map((reason) => (
                    <li key={reason}>
                      <Trans>{reason}</Trans>
                    </li>
                  ))}
                </ul>
              )}
              {autoScores.length > 0 && (
                <div className={styles.scoreRow}>
                  {autoScores.map(([name, score]) => (
                    <span key={name}>
                      {t(title(name))} {Math.round(score)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
