import React, { useEffect, useRef, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Button } from "@progressiveui/react";
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
  const valid =
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
  const scale = Math.min(previewWidth / size.width, 520 / size.height, 1);
  return (
    <IntegrationModal
      store={store}
      passiveModal
      modalHeading={<Trans>Layout</Trans>}
      primaryButtonDisabled={
        !valid || status !== "ready" || readyKey !== previewKey
      }
    >
      <div className={styles.editor}>
        <div className={styles.controls}>
          <label>
            {t("Layout")}
            <select
              value={meta.layout || "columns"}
              onChange={(event) => update("layout", event.target.value)}
            >
              <option value="columns">{t("Side by side")}</option>
              <option value="rows">{t("Stacked")}</option>
              <option value="grid">{t("Grid")}</option>
              <option value="custom">{t("Custom HTML/CSS")}</option>
            </select>
          </label>
          <label>
            {t("Orientation")}
            <select
              value={meta.orientation || "portrait"}
              onChange={(event) => update("orientation", event.target.value)}
            >
              <option value="portrait">{t("Portrait")}</option>
              <option value="landscape">{t("Landscape")}</option>
            </select>
          </label>
          <label>
            {t("Color")}
            <select
              value={meta.color || "blue-light"}
              onChange={(event) => update("color", event.target.value)}
            >
              {["blue-light", "green-light", "red-light", "light", "dark"].map(
                (color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                )
              )}
            </select>
          </label>
          {meta.layout !== "custom" && (
            <>
              <label>
                {t("Spacing (px)")}
                <input
                  type="number"
                  min={0}
                  max={64}
                  value={meta.gap ?? 8}
                  onChange={(event) =>
                    update("gap", Number(event.target.value))
                  }
                />
              </label>
              {meta.layout !== "grid" && (
                <label>
                  {t("First area size")}
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.25}
                    value={meta.ratio || 2}
                    onChange={(event) =>
                      update("ratio", Number(event.target.value))
                    }
                  />
                  <output>{meta.ratio || 2}:1</output>
                </label>
              )}
            </>
          )}
        </div>
        <div className={styles.regions}>
          {regions.map((region, index) => (
            <fieldset key={index}>
              <legend>
                {t("Area")} {index + 1}
              </legend>
              <label>
                {t("Slot name")}
                <input
                  maxLength={32}
                  value={region.id}
                  onChange={(event) =>
                    updateRegion(index, { id: event.target.value })
                  }
                />
              </label>
              <label>
                {t("Content")}
                <select
                  value={region.paperId}
                  onChange={(event) =>
                    updateRegion(index, { paperId: event.target.value })
                  }
                >
                  <option value="">{t("Select content")}</option>
                  {sources.map((paper: any) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.name ||
                        paper.meta?.pluginManifest?.name ||
                        t(paper.kind)}{" "}
                      · {paper.id.slice(-6)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Image processing")}
                <select
                  value={region.processing}
                  onChange={(event) =>
                    updateRegion(index, { processing: event.target.value })
                  }
                >
                  <option value="inherit">{t("From content")}</option>
                  <option value="photo">{t("Photo")}</option>
                  <option value="readable">{t("Text and graphics")}</option>
                  <option value="quantization">
                    {t("Palette colors only")}
                  </option>
                </select>
              </label>
              {sources.find((paper: any) => paper.id === region.paperId)
                ?.kind === "image" && (
                <>
                  <label>
                    {t("Image fit")}
                    <select
                      value={region.fit}
                      onChange={(event) =>
                        updateRegion(index, { fit: event.target.value })
                      }
                    >
                      <option value="cover">{t("Fill")}</option>
                      <option value="contain">{t("Fit")}</option>
                    </select>
                  </label>
                  {region.fit !== "contain" && (
                    <>
                      {(["focalX", "focalY"] as const).map((axis) => (
                        <label key={axis}>
                          {t(
                            axis === "focalX"
                              ? "Horizontal crop"
                              : "Vertical crop"
                          )}
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={region[axis] ?? 50}
                            onChange={(event) =>
                              updateRegion(index, {
                                [axis]: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
                </>
              )}
              {regions.length > 2 && (
                <Button
                  kind="ghost"
                  onClick={() =>
                    update(
                      "regions",
                      regions.filter((_, i) => i !== index)
                    )
                  }
                >
                  {t("Remove area")}
                </Button>
              )}
            </fieldset>
          ))}
        </div>
        {regions.length < 4 && (
          <Button
            kind="secondary"
            onClick={() =>
              update("regions", [
                ...regions,
                newRegion(
                  ["bottom", "extra", "area-four"].find(
                    (id) => !regions.some((region) => region.id === id)
                  )!
                ),
              ])
            }
          >
            {t("Add area")}
          </Button>
        )}
        {meta.layout === "custom" && (
          <div className={styles.custom}>
            <p>
              {t(
                "Use one paperless-slot per area. HTML/CSS only; slots must be rectangular and must not overlap."
              )}
            </p>
            <label>
              HTML
              <textarea
                rows={8}
                maxLength={32000}
                spellCheck={false}
                value={meta.html || ""}
                onChange={(event) => update("html", event.target.value)}
              />
            </label>
            <label>
              CSS
              <textarea
                rows={8}
                maxLength={32000}
                spellCheck={false}
                value={meta.css || ""}
                onChange={(event) => update("css", event.target.value)}
              />
            </label>
          </div>
        )}
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
              ? t("Select content for every area to preview the layout.")
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
        <p>
          {t(
            displayImage
              ? "Display preview with separate processing for each area."
              : "The live preview shows the layout before processing. Use the display preview to check dithering or older integrations."
          )}
        </p>
      </div>
    </IntegrationModal>
  );
}
