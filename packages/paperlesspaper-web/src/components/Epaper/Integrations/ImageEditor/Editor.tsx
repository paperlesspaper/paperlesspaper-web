/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { Button, InlineLoading, Modal } from "@progressiveui/react";
import { useForm } from "react-hook-form";
import dither from "../../dither";
import styles from "./editor.module.scss";

import { Trans, useTranslation } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import Preview from "../../Fields/Preview";
import touchHandler from "./touchEditor";

import {
  colorList,
  //colorsReal,
  colorsMap,
  colorsSlightlyReal,
  colorsBw,
  colorsBwSlightlyReal,
  colorsReal,
} from "../../../SettingsDevices/EpaperDisplay";
import ActiveObject from "./ActiveObject";
import ColorSelect from "./ColorSelect";
import Brightness from "./Brightness";
import Contrast from "./Contrast";
import Saturation from "./Saturation";
import Clarity, { registerClarityIfNeeded } from "./Clarity";
import FontStyles from "./FontStyles";
import { papersApi } from "ducks/ePaper/papersApi";
import DeleteModal from "components/DeleteModal";
import DeletePaper from "./DeletePaper";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCross } from "@fortawesome/pro-regular-svg-icons";
import { faScaleBalanced, faXmark } from "@fortawesome/pro-light-svg-icons";
import { faCheck } from "@fortawesome/pro-solid-svg-icons";
import LineHeight from "./LineHeight";
import LineWidth from "./LineWidth";
import { useActiveDevice } from "helpers/devices/useDevices";
import { useActiveUserDevice } from "helpers/useUsers";
import { deviceByKind } from "helpers/devices/deviceList";
import useEditor, { EditorContextType } from "./useEditor";
import { useDebug } from "helpers/useCurrentUser";
import { spec } from "node:test/reporters";
import KeyboardControl from "./KeyboardControl";
import { colorsSpectra6, useImageEditorContext } from "./ImageEditor";

const isBlobSrc = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("blob:");

const isBlobSourceKey = (value?: string) =>
  value === "src" || value === "source";

const LEGACY_BLOB_PLACEHOLDER_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const sanitizeFabricJsonNode = (
  node: any,
  key?: string,
): { node: any; replaced: number } => {
  if (Array.isArray(node)) {
    let replaced = 0;
    const next = node
      .map((item) => {
        const result = sanitizeFabricJsonNode(item);
        replaced += result.replaced;
        return result.node;
      })
      .filter((item) => item !== null && item !== undefined);

    return { node: next, replaced };
  }

  if (typeof node === "string") {
    if (isBlobSrc(node) && isBlobSourceKey(key)) {
      return {
        node: LEGACY_BLOB_PLACEHOLDER_DATA_URL,
        replaced: 1,
      };
    }
    return { node, replaced: 0 };
  }

  if (!node || typeof node !== "object") {
    return { node, replaced: 0 };
  }

  let replaced = 0;
  const next: Record<string, unknown> = { ...node };

  for (const [key, value] of Object.entries(next)) {
    const result = sanitizeFabricJsonNode(value, key);
    replaced += result.replaced;

    if (result.node === null || result.node === undefined) {
      delete next[key];
    } else {
      next[key] = result.node;
    }
  }

  return { node: next, replaced };
};

const sanitizeLegacyFabricJson = (
  rawData: unknown,
): { json: unknown; replacedBlobCount: number } => {
  const isRawString = typeof rawData === "string";
  let parsed: unknown = rawData;

  if (isRawString) {
    try {
      parsed = JSON.parse(rawData);
    } catch {
      const blobMatches = rawData.match(/blob:[^"'\s)]+/g) || [];
      if (blobMatches.length === 0) {
        return { json: rawData, replacedBlobCount: 0 };
      }

      return {
        json: rawData.replace(
          /blob:[^"'\s)]+/g,
          LEGACY_BLOB_PLACEHOLDER_DATA_URL,
        ),
        replacedBlobCount: blobMatches.length,
      };
    }
  }

  const result = sanitizeFabricJsonNode(parsed);
  if (isRawString) {
    return {
      json: JSON.stringify(result.node),
      replacedBlobCount: result.replaced,
    };
  }

  return { json: result.node, replacedBlobCount: result.replaced };
};

const Editor = ({ uploadSingleImageResult, onSubmit, image }: any) => {
  const {
    fabricRef,
    lastColor,
    setLastColor,
    brushWidth,
    imageEditorTools,
    setBrushWidth,
    canvasRef,
    wrapperRef,
    baseCanvasSizeRef,
    currentScaleRef,
    pageWidth,
    setPageWidth,
    previewCanvasRef,
    previewImageRef,
    previewImage,
    renderCanvasRef,
    preview,
    setPreview,
    ditheringType,
    setDitheringType,
  } = useImageEditorContext();

  const { size, ...store } = useEditor();

  const isDebug = useDebug();

  const { t } = useTranslation();

  const history = useHistory();
  const params = useParams();

  const activeDevice = useActiveUserDevice();
  const deviceMeta = deviceByKind(activeDevice.data?.kind);

  const [generateImageUrlAlt, generateImageUrlAltResult] =
    papersApi.useGenerateImageUrlAltMutation();

  const suppressDirtyRef = useRef(true);
  const hasUserInteractedRef = useRef(false);
  const loadedImageRef = useRef<string | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const markCanvasDirty = (event?: any) => {
    if (suppressDirtyRef.current) return;
    if (!hasUserInteractedRef.current && !event?.e) return;
    if (!store?.form?.setValue) return;
    store.form.setValue("dataEditable", `__dirty__${Date.now()}`, {
      shouldDirty: true,
    });
  };

  const loadeImageData = async () => {
    imageEditorTools.setIsLoadingImageData(true);
    suppressDirtyRef.current = true;

    try {
      const data = await generateImageUrlAlt({
        id: params.paper,
        body: { kind: "editable.json", return: "json" },
      });

      const { json: safeJson, replacedBlobCount } = sanitizeLegacyFabricJson(
        data.data,
      );
      if (replacedBlobCount > 0) {
        console.warn(
          `Replaced ${replacedBlobCount} stale blob URL(s) in legacy editor JSON while loading.`,
        );
      }

      // wait until the JSON (including nested images) is fully parsed into the canvas
      await new Promise<void>((resolve, reject) => {
        const canvas = fabricRef.current;
        if (!canvas) {
          reject(new Error("Editor canvas is not ready."));
          return;
        }

        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("EDITOR_LOAD_TIMEOUT"));
        }, 30_000);

        try {
          console.log("Loading JSON into fabric canvas...", canvas);
          canvas.loadFromJSON(safeJson, () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            canvas.renderAll();
            resolve();
          });
        } catch (err) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          reject(err);
        }
      });
    } catch (err) {
      if (err instanceof Error && err.message === "EDITOR_LOAD_TIMEOUT") {
        window.alert("Loading image data timed out after 30 seconds.");
      }
      console.error("Failed to load image data for editor", err);
    } finally {
      imageEditorTools.setIsLoadingImageData(false);
      hasUserInteractedRef.current = false;
      store?.reset?.(undefined, { keepValues: true, dirty: false });
      setTimeout(() => {
        suppressDirtyRef.current = false;
      }, 0);
    }
  };

  useEffect(() => {
    if (params.paper !== "new") {
      console.log("Loading image data for editor...", params);
      loadeImageData();
    }
  }, [params.entry]);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = store.form || {};

  const lut = watch("meta.lut") || "default";

  // const sleepTime = watch("sleepTime");

  //  const colors = colorList[lut].colors;
  const colors = colorsSpectra6;

  useEffect(() => {
    setLastColor(colors[0]);
  }, [lut]);

  useEffect(() => {
    if (!fabricRef.current?.freeDrawingBrush) return;

    fabricRef.current.freeDrawingBrush.color = lastColor;
  }, [lastColor]);

  useEffect(() => {
    if (!fabricRef.current) return;

    const brush =
      fabricRef.current.freeDrawingBrush ||
      new fabric.PencilBrush(fabricRef.current);

    brush.width = brushWidth;
    fabricRef.current.freeDrawingBrush = brush;
  }, [brushWidth]);

  React.useEffect(() => {
    const initFabric = () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }

      // Ensure custom per-object metadata survives canvas save/load.
      // Fabric only serializes known properties unless we extend `toObject`.
      const proto: any = fabric.Object.prototype;
      if (!proto.__memoToObjectPatched) {
        proto.__memoToObjectPatched = true;
        const originalToObject = proto.toObject;
        proto.toObject = function (...args: any[]) {
          const base = originalToObject.apply(this, args);
          return {
            ...base,
            memoElementType: (this as any).memoElementType,
            qrConfig: (this as any).qrConfig,
            qrPixelSize: (this as any).qrPixelSize,
          };
        };
      }

      fabricRef.current = new fabric.Canvas(canvasRef.current, {
        backgroundColor: "#ffffff",
        imageSmoothingEnabled: false, //false,
        enableRetinaScaling: true, // false,
        preserveObjectStacking: true,
      });

      fabric.InteractiveFabricObject.ownDefaults = {
        ...fabric.InteractiveFabricObject.ownDefaults,

        transparentCorners: false,
        cornerStyle: "circle",
        cornerColor: "#3880ff",
        cornerSize: 15,
        touchCornerSize: 30,
        padding: 0,
        borderScaleFactor: 3,
      };

      console.log("Fabric canvas initialized:", fabricRef.current);
      fabricRef.current.setDimensions({
        width: size.width,
        height: size.height,
      });

      // remember the base logical canvas size (unscaled)
      baseCanvasSizeRef.current = { width: size.width, height: size.height };
      currentScaleRef.current = 1;

      touchHandler({ canvas: fabricRef.current });

      fabricRef.current.filterBackend = fabric.initFilterBackend();

      imageEditorTools.resizeCanvas({});

      fabricRef.current.on({
        "selection:created": function () {
          const ao = fabricRef.current.getActiveObject();
          imageEditorTools.setActiveObject(ao);
        },
      });

      fabricRef.current.on({
        "selection:updated": function () {
          const ao = fabricRef.current.getActiveObject();
          imageEditorTools.setActiveObject(ao);
        },
      });

      fabricRef.current.on({
        "selection:cleared": function () {
          imageEditorTools.setActiveObject(null);
        },
      });

      // When a QR element is scaled/modified, regenerate at a suitable resolution.
      fabricRef.current.on({
        "mouse:down": function () {
          hasUserInteractedRef.current = true;
        },
      });

      fabricRef.current.on({
        "text:changed": function () {
          hasUserInteractedRef.current = true;
          markCanvasDirty({ e: true });
        },
      });

      fabricRef.current.on({
        "object:added": function (e: any) {
          markCanvasDirty(e);
        },
      });

      fabricRef.current.on({
        "object:removed": function (e: any) {
          markCanvasDirty(e);
        },
      });

      fabricRef.current.on({
        "path:created": function (e: any) {
          markCanvasDirty(e);
        },
      });

      fabricRef.current.on({
        "object:modified": function (e: any) {
          markCanvasDirty(e);

          const obj = e?.target;
          if (obj?.memoElementType !== "qr") return;
          if (!obj?.qrConfig) return;
          if (obj?.__updatingQr) return;

          // `object:modified` fires for move/rotate too; only regenerate on scaling.
          const action = e?.transform?.action;
          const isScaling =
            typeof action === "string" &&
            (action === "scale" || action === "scaleX" || action === "scaleY");
          if (!isScaling) return;
          // fire and forget
          imageEditorTools.updateQrCodeObject({ obj, config: obj.qrConfig });
        },
      });

      suppressDirtyRef.current = false;
      setIsCanvasReady(true);
    };

    const getBlob = () => {
      return canvasRef.current.toBlob();
    };

    suppressDirtyRef.current = params.paper !== "new";

    console.log("Initializing fabric canvas...", canvasRef.current);
    initFabric();
    registerClarityIfNeeded();
    if (params.paper === "new") {
      suppressDirtyRef.current = false;
    }

    return () => {
      setIsCanvasReady(false);
      imageEditorTools.disposeFabric();
    };
  }, []);

  useEffect(() => {
    if (!isCanvasReady) return;
    if (!image) return;
    if (loadedImageRef.current === image) return;

    const load = async () => {
      await imageEditorTools.addImageFromUrl({
        url: image,
        width: size.width,
      });
      imageEditorTools.setCurrentObjectActive();
      loadedImageRef.current = image;
    };

    void load();
  }, [isCanvasReady, image, size.width]);

  useEffect(() => {
    window.addEventListener("paste", imageEditorTools.handlePasteAnywhere);
    return () => {
      window.removeEventListener("paste", imageEditorTools.handlePasteAnywhere);
    };
  }, []);

  const scale = pageWidth ? pageWidth / size.width : 1;

  React.useEffect(() => {
    /* const handleResize = () => {
      console.log("handleResize", wrapperRef?.current?.offsetWidth);

      imageEditorTools.resizeCanvas({});
      setPageWidth(wrapperRef?.current?.offsetWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize); */

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        imageEditorTools.resizeCanvas({});
        setPageWidth(wrapperRef?.current?.offsetWidth);
      }
    });

    ro.observe(wrapperRef?.current);
  });

  const containerRef = React.useRef(null);

  const handleClickOutside = (event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      imageEditorTools.discardSelect();
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      {preview && (
        <Modal
          modalHeading={<Trans>Preview</Trans>}
          primaryButtonText={<Trans>Back</Trans>}
          onRequestClose={() => setPreview(false)}
          onRequestSubmit={() => setPreview(false)}
          open
        >
          <Preview
            previewImage={previewImage}
            previewImageRef={previewImageRef}
          />
        </Modal>
      )}

      <div className={styles.editor}>
        <div className={styles.outerWrapper}>
          <div
            className={styles.wrapper}
            ref={wrapperRef}
            //style={{ aspectRatio: `${size.width} /${size.height}` }}
          >
            <div
              className={styles.canvasWrapper}
              // style={{ transform: `scale(${scale})` }}
            >
              <canvas
                ref={canvasRef}
                className={`${styles.canvas} ${styles[lut]}`}
                // onChange={updateImage}
                height={size.height}
                width={size.width}
              />
            </div>

            {imageEditorTools.activeObject && (
              <Button
                className={styles.activeObjectDelete}
                onClick={imageEditorTools.discardSelect}
                //kind="ghost"
                icon={<FontAwesomeIcon icon={faCheck} />}
                iconReverse
              >
                <Trans>Done</Trans>
              </Button>
            )}
          </div>
        </div>

        <div className={isDebug ? styles.debugPreview : styles.preview}>
          <canvas
            className={styles.renderCanvas}
            ref={renderCanvasRef}
            id="renderCanvas"
            height={size.width > size.height ? size.height : size.width}
            width={size.width > size.height ? size.width : size.height}
          />
          <canvas
            ref={previewCanvasRef}
            id="previewCanvas"
            height={size.height}
            width={size.width}
          />
        </div>
      </div>
    </>
  );
};

export default Editor;
