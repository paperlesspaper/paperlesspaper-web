/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { Button, Modal } from "@progressiveui/react";
import styles from "./editor.module.scss";

import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";
import Preview from "../../Fields/Preview";
import touchHandler from "./touchEditor";

import Clarity, { registerClarityIfNeeded } from "./Clarity";
import { papersApi } from "ducks/ePaper/papersApi";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/pro-solid-svg-icons";
import useEditor from "./useEditor";
import { useDebug } from "helpers/useCurrentUser";
import { colorsSpectra6, useImageEditorContext } from "./ImageEditor";
import loadImageDataIntoEditor from "./loadImageDataIntoEditor";
import { registerEpdImageAdjustmentsIfNeeded } from "./imageAdjustmentFilters";

const ROTATION_SNAP_ANGLE = 90;
const ROTATION_SNAP_THRESHOLD = 7;
const ROTATION_SNAP_START_ESCAPE_THRESHOLD = 0.5;

const Editor = ({ image }: any) => {
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
    previewDitheringSettings,
    setPreviewDitheringSettings,
    previewDebugInfo,
  } = useImageEditorContext();

  const { size, ...store } = useEditor();

  const isDebug = useDebug();

  const params = useParams();

  const [generateImageUrlAlt] = papersApi.useGenerateImageUrlAltMutation();

  const suppressDirtyRef = useRef(true);
  const hasUserInteractedRef = useRef(false);
  const loadedImageRef = useRef<string | null>(null);
  const imageEditorToolsRef = useRef(imageEditorTools);
  const isRotationSnapSuppressedRef = useRef(false);
  const isPreviewRefreshingRef = useRef(false);
  const pendingPreviewRefreshRef = useRef(false);
  const lastPreviewDitheringSettingsRef = useRef(previewDitheringSettings);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);

  useEffect(() => {
    imageEditorToolsRef.current = imageEditorTools;
  });

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
      registerClarityIfNeeded();
      registerEpdImageAdjustmentsIfNeeded();

      const canvas = fabricRef.current;
      if (!canvas) {
        throw new Error("Editor canvas is not ready.");
      }

      await loadImageDataIntoEditor({
        fabricCanvas: canvas,
        generateImageUrlAlt,
        paperId: params.paper,
        size,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "EDITOR_LOAD_TIMEOUT") {
        window.alert("Loading image data timed out after 30 seconds.");
      } else {
        window.alert("Loading failed");
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
    if (!isCanvasReady) return;

    if (params.paper !== "new") {
      console.log("Loading image data for editor...", params);
      loadeImageData();
    }
  }, [isCanvasReady, params.entry, params.paper]);

  const { watch } = store.form || {};

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
    const setObjectRotationSnap = (obj: any, isEnabled: boolean) => {
      obj?.set?.({
        snapAngle: isEnabled ? ROTATION_SNAP_ANGLE : 0,
        snapThreshold: ROTATION_SNAP_THRESHOLD,
      });
    };

    const applyRotationSnap = (obj: any) => {
      setObjectRotationSnap(obj, !isRotationSnapSuppressedRef.current);
    };

    const getSnapPointDistance = (angle = 0) => {
      const normalizedAngle = ((angle % 360) + 360) % 360;
      const nearestSnapPoint =
        Math.round(normalizedAngle / ROTATION_SNAP_ANGLE) *
        ROTATION_SNAP_ANGLE;
      const distance = Math.abs(normalizedAngle - nearestSnapPoint);

      return Math.min(distance, 360 - distance);
    };

    const isAtRotationSnapPoint = (obj: any) => {
      return (
        getSnapPointDistance(obj?.angle) <= ROTATION_SNAP_START_ESCAPE_THRESHOLD
      );
    };

    const setCanvasRotationSnap = (isEnabled: boolean) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      canvas.getObjects().forEach((obj: any) => {
        setObjectRotationSnap(obj, isEnabled);
      });
      setObjectRotationSnap(canvas.getActiveObject(), isEnabled);
    };

    const setRotationSnapSuppressed = (isSuppressed: boolean) => {
      if (isRotationSnapSuppressedRef.current === isSuppressed) return;

      isRotationSnapSuppressedRef.current = isSuppressed;
      setCanvasRotationSnap(!isSuppressed);
    };

    const handleRotationSnapKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        setRotationSnapSuppressed(true);
      }
    };

    const handleRotationSnapKeyUp = (event: KeyboardEvent) => {
      if (!event.altKey) {
        setRotationSnapSuppressed(false);
      }
    };

    const handleRotationSnapBlur = () => {
      setRotationSnapSuppressed(false);
    };

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
        snapAngle: ROTATION_SNAP_ANGLE,
        snapThreshold: ROTATION_SNAP_THRESHOLD,
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
          applyRotationSnap(ao);
          imageEditorTools.setActiveObject(ao);
        },
      });

      fabricRef.current.on({
        "selection:updated": function () {
          const ao = fabricRef.current.getActiveObject();
          applyRotationSnap(ao);
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
        "mouse:up": function () {
          setCanvasRotationSnap(!isRotationSnapSuppressedRef.current);
        },
      });

      fabricRef.current.on({
        "before:transform": function (e: any) {
          const transform = e?.transform;
          const obj = transform?.target;

          if (transform?.action !== "rotate") return;
          if (!isAtRotationSnapPoint(obj)) return;

          setObjectRotationSnap(obj, false);
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
          applyRotationSnap(e?.target);
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
          e?.path?.set?.({
            fill: "",
          });
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

    suppressDirtyRef.current = params.paper !== "new";

    console.log("Initializing fabric canvas...", canvasRef.current);
    initFabric();
    window.addEventListener("keydown", handleRotationSnapKeyDown);
    window.addEventListener("keyup", handleRotationSnapKeyUp);
    window.addEventListener("blur", handleRotationSnapBlur);
    registerClarityIfNeeded();
    if (params.paper === "new") {
      suppressDirtyRef.current = false;
    }

    return () => {
      window.removeEventListener("keydown", handleRotationSnapKeyDown);
      window.removeEventListener("keyup", handleRotationSnapKeyUp);
      window.removeEventListener("blur", handleRotationSnapBlur);
      setIsCanvasReady(false);
      imageEditorTools.disposeFabric();
    };
  }, []);

  useEffect(() => {
    if (!isCanvasReady) return;
    if (!image) return;
    if (loadedImageRef.current === image) return;

    const load = async () => {
      imageEditorTools.setIsLoadingImageData(true);
      try {
        const loadedImage = await imageEditorTools.addImageFromUrl({
          url: image,
          width: size.width,
        });
        if (!loadedImage) {
          throw new Error("Image could not be loaded.");
        }

        imageEditorTools.setCurrentObjectActive();
        loadedImageRef.current = image;
      } catch (err) {
        window.alert("Loading failed");
        console.error("Failed to load image in editor", err);
      } finally {
        imageEditorTools.setIsLoadingImageData(false);
      }
    };

    void load();
  }, [isCanvasReady, image, size.width]);

  useEffect(() => {
    window.addEventListener("paste", imageEditorTools.handlePasteAnywhere);
    window.addEventListener(
      "dragover",
      imageEditorTools.handleDragOverAnywhere,
    );
    window.addEventListener("drop", imageEditorTools.handleDropAnywhere);
    return () => {
      window.removeEventListener("paste", imageEditorTools.handlePasteAnywhere);
      window.removeEventListener(
        "dragover",
        imageEditorTools.handleDragOverAnywhere,
      );
      window.removeEventListener("drop", imageEditorTools.handleDropAnywhere);
    };
  }, []);

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

  const refreshPreview = React.useCallback(async () => {
    if (imageEditorToolsRef.current.isLoadingImageData) return;

    if (isPreviewRefreshingRef.current) {
      pendingPreviewRefreshRef.current = true;
      return;
    }

    isPreviewRefreshingRef.current = true;
    setIsPreviewRefreshing(true);
    try {
      do {
        pendingPreviewRefreshRef.current = false;
        await imageEditorToolsRef.current.openPreviewImage(true);
      } while (
        pendingPreviewRefreshRef.current &&
        !imageEditorToolsRef.current.isLoadingImageData
      );
    } finally {
      isPreviewRefreshingRef.current = false;
      setIsPreviewRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!preview) {
      lastPreviewDitheringSettingsRef.current = previewDitheringSettings;
      return;
    }

    if (lastPreviewDitheringSettingsRef.current === previewDitheringSettings) {
      return;
    }

    lastPreviewDitheringSettingsRef.current = previewDitheringSettings;
    const timeout = window.setTimeout(() => {
      void refreshPreview();
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [preview, previewDitheringSettings, refreshPreview]);

  return (
    <>
      {preview && (
        <Modal
          modalHeading={<Trans>Preview</Trans>}
          primaryButtonText={<Trans>Back</Trans>}
          onRequestClose={() => setPreview(false)}
          onRequestSubmit={() => setPreview(false)}
          kind="fullscreen"
          kindMobile="fullscreen"
          overscrollBehavior="inside"
          open
        >
          <Preview
            previewImage={previewImage}
            previewImageRef={previewImageRef}
            ditheringSettings={previewDitheringSettings}
            previewDebugInfo={previewDebugInfo}
            isDebug={isDebug}
            isRefreshingPreview={isPreviewRefreshing}
            onDitheringSettingsChange={setPreviewDitheringSettings}
            onRefreshPreview={refreshPreview}
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
