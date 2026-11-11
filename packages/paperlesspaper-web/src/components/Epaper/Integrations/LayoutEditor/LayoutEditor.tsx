import React, { useEffect, useRef, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  Button,
  NumberInput,
  Select,
  SelectItem,
  Slider,
  TextArea,
  TextInput,
} from "@progressiveui/react";
import PaperSelectionGrid from "../components/PaperSelectionGrid";
import { papersApi } from "ducks/ePaper/papersApi";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import useRotationList from "../ImageEditor/useRotationList";
import styles from "./layoutEditor.module.scss";

export const LAYOUT_URL =
  import.meta.env.REACT_APP_LAYOUT_RENDER_URL ||
  "https://integrations.paperlesspaper.de/layout/render.html";
const defaultHtml =
  '<div class="dashboard">\n  <paperless-slot name="left"></paperless-slot>\n  <paperless-slot name="right"></paperless-slot>\n</div>';
const defaultCss =
  ".dashboard { display: grid; width: 100%; height: 100%; grid-template-columns: 2fr 1fr; gap: 12px; }\n@media (orientation: portrait) {\n  .dashboard { grid-template-columns: 1fr; grid-template-rows: 2fr 1fr; }\n}";
type Region = {
  id: string;
  paperId: string;
  processing: string;
  fit: string;
  focalX: number;
  focalY: number;
};
const newRegion = (id: string): Region => ({
  id,
  paperId: "",
  processing: "inherit",
  fit: "cover",
  focalX: 50,
  focalY: 50,
});

export default function LayoutEditor() {
  const { t } = useTranslation();
  const store = useIntegrationForm({
    defaultValues: {
      kind: "layout",
      meta: {
        layout: "columns",
        ratio: 2,
        gap: 8,
        html: defaultHtml,
        css: defaultCss,
        color: "blue-light",
        regions: [newRegion("left"), newRegion("right")],
      },
    },
  });
  const { form } = store;
  const meta = form.watch("meta") || {};
  const regions: Region[] = meta.regions || [];
  const rotations = useRotationList(meta.frameKind);
  const size = rotations[meta.orientation || "portrait"] || rotations.portrait;
  const [resolveLayout] = papersApi.useResolveLayoutMutation();
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [renderingDisplay, setRenderingDisplay] = useState(false);
  const displayRequest = useRef<any>(null);
  const currentPreview = useRef("");
  const [payload, setPayload] = useState<any>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(500);
  const [readyKey, setReadyKey] = useState("");
  const sources = (store.organizationPapers.data || []).filter(
    (paper: any) =>
      !["layout", "slides", "playlist", "printer"].includes(paper.kind)
  );
  const [selectingArea, setSelectingArea] = useState<number | null>(0);
  const gapValid =
    Number.isInteger(meta.gap) && meta.gap >= 0 && meta.gap <= 64;
  const ratioValid =
    typeof meta.ratio === "number" && meta.ratio >= 0.25 && meta.ratio <= 4;
  const slotErrors = regions.map((region, index) =>
    !/^[a-z][a-z0-9-]{0,31}$/.test(region.id)
      ? t(
          "Use a lowercase letter first, then letters, numbers or hyphens (max. 32)."
        )
      : regions.some((other, i) => i !== index && other.id === region.id)
      ? t("Each area needs a unique slot name.")
      : ""
  );
  const validationMessage = !gapValid
    ? t("Enter a whole number from 0 to 64 for spacing.")
    : !ratioValid
    ? t("Choose an area ratio from 0.25 to 4.")
    : slotErrors.find(Boolean) ||
      t("Select content for every area to preview the layout.");
  const valid =
    gapValid &&
    ratioValid &&
    regions.length >= 2 &&
    regions.length <= 4 &&
    regions.every(
      (region) =>
        /^[a-f\d]{24}$/i.test(region.paperId) &&
        /^[a-z][a-z0-9-]{0,31}$/.test(region.id)
    ) &&
    new Set(regions.map((region) => region.id)).size === regions.length;
  const settingsKey = JSON.stringify({
    layout: meta.layout,
    ratio: meta.ratio,
    gap: meta.gap,
    html: meta.html,
    css: meta.css,
    color: meta.color,
    regions,
  });
  const previewKey = `${settingsKey}:${meta.frameKind}:${meta.orientation}:${size.width}:${size.height}`;
  currentPreview.current = previewKey;
  const update = (key: string, value: unknown) =>
    form.setValue(`meta.${key}`, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  const updateRegion = (index: number, patch: Partial<Region>) =>
    update(
      "regions",
      regions.map((region, i) =>
        i === index ? { ...region, ...patch } : region
      )
    );
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) =>
      setPreviewWidth(entries[0].contentRect.width)
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    displayRequest.current?.abort();
    setDisplayImage(null);
    setRenderingDisplay(false);
    setPayload(null);
    setError("");
    setStatus(valid ? "loading" : "idle");
    if (!valid || !store.params.organization) return;
    let active = true;
    let request: any;
    const timer = setTimeout(() => {
      request = resolveLayout({
        organization: store.params.organization,
        settings: JSON.parse(settingsKey),
      });
      request
        .unwrap()
        .then((result: any) => {
          if (active) setPayload(result);
        })
        .catch((reason: any) => {
          if (active) {
            setStatus("error");
            setError(
              reason?.data?.message || t("Layout contents could not be loaded.")
            );
          }
        });
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
      request?.abort();
    };
  }, [
    settingsKey,
    previewKey,
    valid,
    store.params.organization,
    resolveLayout,
    retry,
    size.width,
    size.height,
    t,
  ]);
  const sendPayload = () => {
    if (payload && frame.current?.contentWindow)
      frame.current.contentWindow.postMessage(
        { type: "INIT", cmd: "message", data: payload },
        new URL(LAYOUT_URL).origin
      );
  };
  useEffect(() => {
    sendPayload();
  }, [payload]);
  useEffect(() => {
    if (!payload) return;
    const timeout = setTimeout(() => {
      setStatus("error");
      setError(
        t(
          "Layout preview timed out. Check that each integration supports embedded rendering."
        )
      );
    }, 18_000);
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== new URL(LAYOUT_URL).origin ||
        event.data?.type !== "PAPERLESS_LAYOUT_STATUS" ||
        event.data.renderId !== payload.layout.renderId
      )
        return;
      clearTimeout(timeout);
      setStatus(event.data.status);
      if (event.data.status === "ready") setReadyKey(previewKey);
      if (event.data.status === "error")
        setError(event.data.error || t("Layout contents could not be loaded."));
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
  }, [payload, previewKey, t]);
  const renderDisplayPreview = async () => {
    const key = previewKey;
    setPayload(null);
    setDisplayImage(null);
    setError("");
    setRenderingDisplay(true);
    setStatus("loading");
    const request = resolveLayout({
      organization: store.params.organization,
      settings: JSON.parse(settingsKey),
      mode: "render",
      frameKind: meta.frameKind || "epd7",
      orientation: meta.orientation || "portrait",
    });
    displayRequest.current = request;
    try {
      const result = await request.unwrap();
      if (currentPreview.current !== key || displayRequest.current !== request)
        return;
      setDisplayImage(result.image);
      setReadyKey(key);
      setStatus("ready");
    } catch (reason: any) {
      if (
        currentPreview.current === key &&
        displayRequest.current === request
      ) {
        setStatus("error");
        setError(
          reason?.data?.message || t("Layout contents could not be loaded.")
        );
      }
    } finally {
      if (displayRequest.current === request) setRenderingDisplay(false);
    }
  };
  useEffect(() => () => displayRequest.current?.abort(), []);
  const scale = Math.min(
    previewWidth / size.width,
    (previewWidth < 420 ? 320 : 520) / size.height,
    1
  );
  return (
    <IntegrationModal
      store={store}
      passiveModal
      modalClassName={styles.modal}
      modalHeading={<Trans>Layout</Trans>}
      primaryButtonDisabled={
        !valid || status !== "ready" || readyKey !== previewKey
      }
    >
      <div className={styles.editor}>
        <div className={styles.settings}>
          <section className={styles.section}>
            <h3>{t("Layout settings")}</h3>
            <div className={styles.controls}>
              <Select
                id="layout-preset"
                labelText={t("Layout")}
                value={meta.layout || "columns"}
                onChange={(event) => update("layout", event.target.value)}
              >
                {[
                  ["columns", "Side by side"],
                  ["rows", "Stacked"],
                  ["grid", "Grid"],
                  ["custom", "Custom HTML/CSS"],
                ].map(([value, label]) => (
                  <SelectItem key={value} value={value} text={t(label)} />
                ))}
              </Select>
              <Select
                id="layout-orientation"
                labelText={t("Orientation")}
                value={meta.orientation || "portrait"}
                onChange={(event) => update("orientation", event.target.value)}
              >
                <SelectItem value="portrait" text={t("Portrait")} />
                <SelectItem value="landscape" text={t("Landscape")} />
              </Select>
              <Select
                id="layout-color"
                labelText={t("Color")}
                value={meta.color || "blue-light"}
                onChange={(event) => update("color", event.target.value)}
              >
                {[
                  ["blue-light", "Blue"],
                  ["green-light", "Green"],
                  ["red-light", "Red"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ].map(([value, label]) => (
                  <SelectItem key={value} value={value} text={t(label)} />
                ))}
              </Select>
              {(meta.layout !== "custom" || !gapValid) && (
                <NumberInput
                  id="layout-gap"
                  labelText={t("Spacing (px)")}
                  min={0}
                  max={64}
                  step={1}
                  value={meta.gap ?? ""}
                  invalid={!gapValid}
                  invalidText={t(
                    "Enter a whole number from 0 to 64 for spacing."
                  )}
                  onChange={(event, value) => {
                    const raw =
                      event?.imaginaryTarget?.value ??
                      event?.target?.value ??
                      value;
                    update("gap", raw === "" || raw == null ? "" : Number(raw));
                  }}
                />
              )}
            </div>
            {!["custom", "grid"].includes(meta.layout) && (
              <Slider
                id="layout-ratio"
                labelText={t("First area size")}
                min={0.25}
                max={4}
                step={0.25}
                value={meta.ratio ?? 2}
                fullWidth
                hideTextInput
                helperText={`${meta.ratio ?? 2}:1`}
                onChange={(event) =>
                  update("ratio", Number(event.target.value))
                }
              />
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h3>{t("Layout contents")}</h3>
              <span>{regions.length} / 4</span>
            </div>
            <p className={styles.hint}>
              {t("Choose a preview image for each area.")}
            </p>
            <div className={styles.regions}>
              {regions.map((region, index) => {
                const selected = sources.find(
                  (paper: any) => paper.id === region.paperId
                );
                const selecting = selectingArea === index;
                return (
                  <fieldset key={index} className={styles.region}>
                    <legend>
                      {t("Area")} {index + 1}
                    </legend>
                    <div className={styles.contentChoice}>
                      {selected && !selecting && (
                        <div className={styles.selectedPaper}>
                          <PaperSelectionGrid
                            papers={[selected]}
                            organization={store.params.organization}
                            selectedPaperIds={{ [region.paperId]: true }}
                            inputType="radio"
                            inputName={`layout-selected-${index}`}
                            onTogglePaper={() => setSelectingArea(index)}
                          />
                        </div>
                      )}
                      <Button
                        kind={selecting ? "tertiary" : "secondary"}
                        type="button"
                        aria-expanded={selecting}
                        aria-controls={`layout-picker-${index}`}
                        onClick={() =>
                          setSelectingArea(selecting ? null : index)
                        }
                      >
                        {selected ? t("Change content") : t("Select content")}
                      </Button>
                    </div>
                    {selecting && (
                      <div
                        id={`layout-picker-${index}`}
                        className={styles.picker}
                        role="group"
                        aria-label={`${t("Content")} · ${t("Area")} ${
                          index + 1
                        }`}
                      >
                        {store.organizationPapers.isLoading ? (
                          <p role="status">{t("Loading contents…")}</p>
                        ) : store.organizationPapers.isError ? (
                          <p role="alert">
                            {t("Contents could not be loaded.")}
                          </p>
                        ) : sources.length === 0 ? (
                          <p>
                            {t(
                              "Add an image or integration to your library first."
                            )}
                          </p>
                        ) : (
                          <PaperSelectionGrid
                            papers={sources}
                            organization={store.params.organization}
                            selectedPaperIds={{ [region.paperId]: true }}
                            inputType="radio"
                            inputName={`layout-paper-${index}`}
                            onTogglePaper={(paperId) => {
                              updateRegion(index, { paperId });
                              setSelectingArea(null);
                            }}
                          />
                        )}
                      </div>
                    )}
                    {(meta.layout === "custom" || slotErrors[index]) && (
                      <TextInput
                        id={`layout-slot-${index}`}
                        labelText={t("Slot name")}
                        maxLength={32}
                        value={region.id}
                        invalid={Boolean(slotErrors[index])}
                        invalidText={slotErrors[index]}
                        onChange={(event) =>
                          updateRegion(index, { id: event.target.value })
                        }
                      />
                    )}
                    <details className={styles.areaSettings}>
                      <summary>{t("Area settings")}</summary>
                      <div>
                        <Select
                          id={`layout-processing-${index}`}
                          labelText={t("Image processing")}
                          value={region.processing}
                          onChange={(event) =>
                            updateRegion(index, {
                              processing: event.target.value,
                            })
                          }
                        >
                          {[
                            ["inherit", "From content"],
                            ["photo", "Photo"],
                            ["readable", "Text and graphics"],
                            ["quantization", "Palette colors only"],
                          ].map(([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              text={t(label)}
                            />
                          ))}
                        </Select>
                        {selected?.kind === "image" && (
                          <>
                            <Select
                              id={`layout-fit-${index}`}
                              labelText={t("Image fit")}
                              value={region.fit}
                              onChange={(event) =>
                                updateRegion(index, { fit: event.target.value })
                              }
                            >
                              <SelectItem
                                value="cover"
                                text={t("Crop to fill")}
                              />
                              <SelectItem value="contain" text={t("Fit")} />
                            </Select>
                            {region.fit !== "contain" &&
                              (["focalX", "focalY"] as const).map((axis) => (
                                <Slider
                                  key={axis}
                                  id={`layout-${axis}-${index}`}
                                  fullWidth
                                  hideTextInput
                                  labelText={t(
                                    axis === "focalX"
                                      ? "Horizontal crop"
                                      : "Vertical crop"
                                  )}
                                  min={0}
                                  max={100}
                                  value={region[axis] ?? 50}
                                  onChange={(event) =>
                                    updateRegion(index, {
                                      [axis]: Number(event.target.value),
                                    })
                                  }
                                />
                              ))}
                          </>
                        )}
                      </div>
                    </details>
                    {regions.length > 2 && (
                      <Button
                        type="button"
                        kind="ghost"
                        onClick={() => {
                          update(
                            "regions",
                            regions.filter((_, i) => i !== index)
                          );
                          setSelectingArea(null);
                        }}
                      >
                        {t("Remove area")}
                      </Button>
                    )}
                  </fieldset>
                );
              })}
            </div>
            {regions.length < 4 && (
              <Button
                type="button"
                kind="secondary"
                onClick={() => {
                  let suffix = regions.length + 1;
                  while (
                    regions.some((region) => region.id === `area-${suffix}`)
                  )
                    suffix++;
                  update("regions", [...regions, newRegion(`area-${suffix}`)]);
                  setSelectingArea(regions.length);
                }}
              >
                {t("Add area")}
              </Button>
            )}
          </section>
          {meta.layout === "custom" && (
            <section className={`${styles.section} ${styles.custom}`}>
              <h3>{t("Custom HTML/CSS")}</h3>
              <p className={styles.hint}>
                {t(
                  "Use one paperless-slot per area. HTML/CSS only; slots must be rectangular and must not overlap."
                )}
              </p>
              <TextArea
                id="layout-html"
                labelText="HTML"
                rows={8}
                maxLength={32000}
                spellCheck={false}
                value={meta.html || ""}
                onChange={(event) => update("html", event.target.value)}
              />
              <TextArea
                id="layout-css"
                labelText="CSS"
                rows={8}
                maxLength={32000}
                spellCheck={false}
                value={meta.css || ""}
                onChange={(event) => update("css", event.target.value)}
              />
            </section>
          )}
        </div>
        <aside className={styles.previewPanel}>
          <div className={styles.sectionHeading}>
            <h3>{t("Layout preview")}</h3>
            <span>
              {size.width} × {size.height}
            </span>
          </div>
          <Button
            kind="secondary"
            disabled={
              !valid || renderingDisplay || (status === "loading" && !payload)
            }
            onClick={renderDisplayPreview}
          >
            {t("Render display preview")}
          </Button>
          <div ref={container} className={styles.preview}>
            {!payload && !displayImage && meta.layout !== "custom" && (
              <div
                className={styles.schematic}
                aria-hidden="true"
                style={{
                  gridTemplateColumns:
                    meta.layout === "rows"
                      ? "1fr"
                      : meta.layout === "grid"
                      ? "1fr 1fr"
                      : `${meta.ratio || 2}fr ${regions
                          .slice(1)
                          .map(() => "1fr")
                          .join(" ")}`,
                  gridTemplateRows:
                    meta.layout === "rows"
                      ? `${meta.ratio || 2}fr ${regions
                          .slice(1)
                          .map(() => "1fr")
                          .join(" ")}`
                      : undefined,
                }}
              >
                {regions.map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
            )}
            {displayImage && (
              <img
                src={displayImage}
                alt={t("Processed layout preview")}
                style={{
                  display: "block",
                  width: size.width * scale,
                  height: size.height * scale,
                  margin: "0 auto",
                }}
              />
            )}
            {payload && (
              <div
                style={{
                  width: size.width * scale,
                  height: size.height * scale,
                  position: "relative",
                  margin: "0 auto",
                }}
              >
                <iframe
                  ref={frame}
                  key={payload.layout.renderId}
                  src={LAYOUT_URL}
                  title={t("Layout preview")}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={sendPayload}
                  style={{
                    border: 0,
                    width: size.width,
                    height: size.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                />
              </div>
            )}
            <p role="status">
              {status === "loading"
                ? t("Loading layout preview…")
                : status === "ready"
                ? t("Layout preview ready")
                : status === "idle"
                ? validationMessage
                : ""}
            </p>
            {error && <p role="alert">{error}</p>}
            {status === "error" && (
              <Button
                kind="secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                {t("Retry")}
              </Button>
            )}
          </div>
          <p className={styles.hint}>
            {t(
              displayImage
                ? "Display preview with separate processing for each area."
                : "The live preview shows the layout before processing. Use the display preview to check dithering or older integrations."
            )}
          </p>
        </aside>
      </div>
    </IntegrationModal>
  );
}
