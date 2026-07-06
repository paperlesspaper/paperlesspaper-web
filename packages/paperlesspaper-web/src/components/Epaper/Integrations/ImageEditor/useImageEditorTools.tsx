import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";

import {
  clampQrPixelSize,
  generateQrPngDataUrl,
  type QrCodeConfig,
} from "./qrCodeUtils";

import {
  aitjcizeSpectra6Palette,
  ditherImage,
  replaceColors,
  suggestCanvasProcessingOptions,
  type DitherImageOptions,
} from "epdoptimize";
import {
  applyDitherOptionsToPreviewSettings,
  buildPreviewDebugInfo,
  buildPreviewDitherOptions,
  FAST_PREVIEW_MAX_LONG_EDGE,
  getPreviewSuggestionSettingsSource,
} from "../../Fields/PreviewDitheringTool/options";
import type {
  PreviewDitheringDebugInfo,
  PreviewDitheringSettings,
} from "../../Fields/PreviewDitheringTool/types";
import { setEditorImageSourceMetadata } from "./editorImageSources";
import {
  prepareImageFileSourcesForEditor,
  prepareImageUrlForEditor,
} from "./imageDataUrl";

type CanvasSize = {
  width: number;
  height: number;
};

type GeneratePreviewOptions = Partial<
  Pick<
    PreviewDitheringSettings,
    | "useFastPreviewAnalysis"
    | "skipUnneededPreviewSuggestions"
    | "useAcceleratedPreviewProcessing"
  >
>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getPreviewPerformanceNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const roundTimingMs = (value: number) => Number(value.toFixed(2));

const recordPreviewTiming = (
  timings: Record<string, number>,
  name: string,
  startedAt: number,
) => {
  timings[name] = roundTimingMs(getPreviewPerformanceNow() - startedAt);
};

const getFastPreviewCanvasSize = (
  width: number,
  height: number,
  previewOptions?: DitherImageOptions["preview"],
): CanvasSize | null => {
  if (previewOptions?.mode !== "fast") return null;

  let scale = 1;
  const longEdge = Math.max(width, height);
  if (
    isFiniteNumber(previewOptions.maxLongEdge) &&
    previewOptions.maxLongEdge > 0 &&
    longEdge > previewOptions.maxLongEdge
  ) {
    scale = Math.min(scale, previewOptions.maxLongEdge / longEdge);
  }

  const pixels = width * height;
  if (
    isFiniteNumber(previewOptions.maxPixels) &&
    previewOptions.maxPixels > 0 &&
    pixels > previewOptions.maxPixels
  ) {
    scale = Math.min(scale, Math.sqrt(previewOptions.maxPixels / pixels));
  }

  if (scale >= 1) return null;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const createScaledPreviewSourceCanvas = (
  sourceCanvas: HTMLCanvasElement,
  size: CanvasSize,
): HTMLCanvasElement | null => {
  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = size.width;
  scaledCanvas.height = size.height;

  const scaledContext = scaledCanvas.getContext("2d");
  if (!scaledContext) return null;

  scaledContext.imageSmoothingEnabled = true;
  scaledContext.drawImage(sourceCanvas, 0, 0, size.width, size.height);

  return scaledCanvas;
};

const canvasToObjectUrl = (canvas: HTMLCanvasElement): Promise<string | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }

      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });

export default function imageEditorTools({
  fabricRef,
  store,
  baseCanvasSizeRef,
  currentScaleRef,
  lastColor,
  brushWidth,
  setLastColor: _setLastColor,
  previewCanvasRef,
  renderCanvasRef,
  canvasRef,
  wrapperRef,
  setPreview,
  setPreviewImage,
  previewDitheringSettings,
  setPreviewDitheringSettings,
  setPreviewDebugInfo,
}: any) {
  const [activeObject, setActiveObject] = useState(null);

  const [isLoadingImageData, setIsLoadingImageData] = useState(false);
  const previewImageObjectUrlRef = useRef<string | null>(null);

  const revokePreviewImageObjectUrl = () => {
    if (!previewImageObjectUrlRef.current) return;

    URL.revokeObjectURL(previewImageObjectUrlRef.current);
    previewImageObjectUrlRef.current = null;
  };

  useEffect(() => revokePreviewImageObjectUrl, []);

  const loadFabricImage = async (
    url: string,
    options: { crossOrigin?: "anonymous" | "" | null } = {},
  ) => {
    const result: any = fabric.Image.fromURL(url, {
      crossOrigin: options.crossOrigin ?? null,
    });
    if (result && typeof result.then === "function") {
      return await result;
    }

    return await new Promise((resolve) => {
      fabric.Image.fromURL(url, { crossOrigin: options.crossOrigin ?? null })
        .then((img: any) => resolve(img))
        .catch(() => resolve(null));
    });
  };

  const isQrObject = (obj: any) => obj?.memoElementType === "qr";

  const getDesiredQrDisplaySize = (obj: any) => {
    if (!obj) return 240;
    const w =
      typeof obj.getScaledWidth === "function" ? obj.getScaledWidth() : 0;
    const h =
      typeof obj.getScaledHeight === "function" ? obj.getScaledHeight() : 0;
    const size = Math.max(w || 0, h || 0);
    return size || 240;
  };

  const getSuggestedQrPixelSizeForObject = (obj: any) => {
    const displaySize = getDesiredQrDisplaySize(obj);
    // Render at higher resolution than the on-canvas display size to stay crisp.
    return clampQrPixelSize(displaySize * 2);
  };

  const updateQrCodeObject = async ({
    obj,
    config,
    pixelSize,
  }: {
    obj: any;
    config: QrCodeConfig;
    pixelSize?: number;
  }) => {
    if (!fabricRef?.current || !obj) return;

    const sizePx = clampQrPixelSize(
      pixelSize ?? getSuggestedQrPixelSizeForObject(obj),
    );

    // prevent recursion if we regenerate from a fabric event
    if (obj.__updatingQr) return;
    obj.__updatingQr = true;

    try {
      const dataUrl = await generateQrPngDataUrl({ config, sizePx });

      const scaleX = obj.scaleX;
      const scaleY = obj.scaleY;
      const left = obj.left;
      const top = obj.top;
      const angle = obj.angle;
      const flipX = obj.flipX;
      const flipY = obj.flipY;

      if (typeof obj.setSrc === "function") {
        await obj.setSrc(dataUrl);
      }

      obj.set({
        memoElementType: "qr",
        qrConfig: config,
        qrPixelSize: sizePx,
        lockUniScaling: true,
        centeredScaling: true,
        left,
        top,
        angle,
        flipX,
        flipY,
      });

      // Preserve the exact scaling factor.
      // Using `scaleToWidth(getScaledWidth())` can drift because `getScaledWidth()`
      // may include other transforms (e.g. zoom / viewport), and it also re-derives
      // scaling from a rounded measurement.
      obj.scaleX = scaleX;
      obj.scaleY = scaleY;

      if (typeof obj.setCoords === "function") obj.setCoords();
      fabricRef.current.fire?.("object:modified", { target: obj, e: true });
      fabricRef.current.requestRenderAll?.();
    } finally {
      obj.__updatingQr = false;
    }
  };

  const addQrCodeObject = async (config: QrCodeConfig) => {
    if (!fabricRef?.current) return;

    const sizePx = clampQrPixelSize(512);
    const dataUrl = await generateQrPngDataUrl({ config, sizePx });

    const img = await loadFabricImage(dataUrl);

    const canvasSize = getCanvasSize();
    img.set({
      left: canvasSize.width / 2,
      top: canvasSize.height / 2,
      lockUniScaling: true,
      centeredScaling: true,
      memoElementType: "qr",
      qrConfig: config,
      qrPixelSize: sizePx,
    });

    img.scaleToWidth(240);
    fabricRef.current.add(img);
    fabricRef.current.setActiveObject(img);
    fabricRef.current.renderAll();
    setActiveObject(img);
    fabricRef.current.fire?.("object:modified", { target: img, e: true });
    return img;
  };

  const addImageFromUrl = async ({
    url,
    previewUrl,
    fullUrl,
    width,
    crossOrigin,
    fit,
  }: {
    url: string;
    previewUrl?: string;
    fullUrl?: string;
    width?: number;
    crossOrigin?: "anonymous" | "" | null;
    fit?: "cover";
  }) => {
    if (!url || !fabricRef?.current) return null;

    let source = {
      previewUrl: previewUrl || url,
      fullUrl: fullUrl || url,
    };

    if (!previewUrl && !fullUrl) {
      try {
        source = await prepareImageUrlForEditor({
          imageUrl: url,
          crossOrigin,
        });
      } catch (error) {
        console.warn("Could not prepare editor preview source", error);
      }
    }

    const img = await loadFabricImage(source.previewUrl, { crossOrigin });
    if (!img) return null;
    const canvas = fabricRef.current;
    const canvasSize = getCanvasSize();

    setEditorImageSourceMetadata(
      img,
      {
        ...source,
        previewUrl: source.previewUrl || url,
        fullUrl: source.fullUrl || url,
      },
      crossOrigin,
    );

    img.set({
      left: canvasSize.width / 2,
      top: canvasSize.height / 2,
      originX: "center",
      originY: "center",
      lockUniScaling: true,
      centeredScaling: true,
    });

    if (fit === "cover") {
      const el: any = img?._originalElement || img?._element;
      const naturalWidth = el?.naturalWidth || el?.width || img.width || 1;
      const naturalHeight = el?.naturalHeight || el?.height || img.height || 1;
      const scale = Math.max(
        canvasSize.width / naturalWidth,
        canvasSize.height / naturalHeight,
      );

      img.set({
        cropX: 0,
        cropY: 0,
        width: naturalWidth,
        height: naturalHeight,
        scaleX: scale,
        scaleY: scale,
      });
    } else if (width) {
      img.scaleToWidth(width);
    }

    img.setControlVisible("ml", false);
    img.setControlVisible("mt", false);
    img.setControlVisible("mr", false);
    img.setControlVisible("mb", false);

    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();

    return img;
  };

  const isImageFile = (file: File) => {
    if (file.type?.startsWith("image/")) return true;
    return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
  };

  const getImageFileFromDataTransfer = (dataTransfer?: DataTransfer | null) => {
    if (!dataTransfer) return null;

    const files = Array.from(dataTransfer.files || []);
    const imageFile = files.find(isImageFile);
    if (imageFile) return imageFile;

    const items = Array.from(dataTransfer.items || []);
    const imageItem = items.find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );

    return imageItem?.getAsFile?.() || null;
  };

  const hasFileDataTransfer = (dataTransfer?: DataTransfer | null) => {
    if (!dataTransfer) return false;
    if (Array.from(dataTransfer.types || []).includes("Files")) return true;
    if (Array.from(dataTransfer.files || []).length > 0) return true;
    return Array.from(dataTransfer.items || []).some(
      (item) => item.kind === "file",
    );
  };

  const addImageFileAsEditorElement = async (file: File) => {
    if (!file || !isImageFile(file) || !fabricRef?.current) return null;

    const source = await prepareImageFileSourcesForEditor(file);
    return addImageFromUrl({
      url: source.fullUrl,
      previewUrl: source.previewUrl,
      fullUrl: source.fullUrl,
      width: store.size.width,
    });
  };

  const setCurrentObjectActive = () => {
    const deviceAdd = fabricRef.current.getObjects();
    fabricRef.current.setActiveObject(
      fabricRef.current.item(deviceAdd.length - 1),
    );
  };

  const prepareDrawingBrush = () => {
    if (!fabricRef.current) return null;

    const brush =
      fabricRef.current.freeDrawingBrush ||
      new fabric.PencilBrush(fabricRef.current);

    brush.color = lastColor;
    brush.width = brushWidth;
    fabricRef.current.freeDrawingBrush = brush;

    return brush;
  };

  const enableDrawingMode = () => {
    if (!fabricRef.current) return;

    prepareDrawingBrush();
    fabricRef.current.isDrawingMode = true;
    fabricRef.current.selection = false;
    fabricRef.current.discardActiveObject();
    setActiveObject({ type: "drawing" });
  };

  const disableDrawingMode = () => {
    if (!fabricRef.current) return;

    fabricRef.current.isDrawingMode = false;
    fabricRef.current.selection = true;
    setActiveObject(null);
  };

  const toggleDrawingMode = () => {
    if (activeObject?.type === "drawing") {
      disableDrawingMode();
    } else {
      enableDrawingMode();
    }
  };

  const disposeFabric = () => {
    if (!fabricRef.current) return;
    fabricRef.current.dispose();
    fabricRef.current = null;
  };

  // Fabric.js image function
  const canvasImage = async (url) => {
    const img = new fabric.Image(url);
    img.set({
      left: 0,
      top: 0,
    });
    img.scaleToWidth(store.size.width);

    const loadedImage = await loadFabricImage(url);
    fabricRef.current.add(loadedImage);
  };

  const handlePasteAnywhere = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Get the data of clipboard
    const clipboardItems = event.clipboardData.items;
    const items = [].slice.call(clipboardItems).filter(function (item) {
      // Filter the image items only
      return item.type.indexOf("image") !== -1;
    });
    if (items.length === 0) {
      return;
    }

    const item = items[0];
    // Get the blob of image
    const blob = item.getAsFile();
    const imageURL = window.webkitURL.createObjectURL(blob);
    void canvasImage(imageURL);
  };

  const handleDragOverAnywhere = (event: DragEvent) => {
    if (!hasFileDataTransfer(event.dataTransfer)) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDropAnywhere = (event: DragEvent) => {
    if (!hasFileDataTransfer(event.dataTransfer)) return;

    event.preventDefault();
    event.stopPropagation();

    const imageFile = getImageFileFromDataTransfer(event.dataTransfer);
    if (!imageFile) return;

    void addImageFileAsEditorElement(imageFile).catch((err) => {
      console.error("Failed to add dropped image to editor", err);
    });
  };

  const rotateCanvas = ({ colorsReplace, ref }: any) => {
    const destCtx = ref.current.getContext("2d");
    void _setLastColor;
    void colorsReplace;

    //destCtx.rotate(Math.PI / 2);

    destCtx.translate(destCtx.canvas.width * 0.5, destCtx.canvas.height * 0.5); // center
    destCtx.rotate(Math.PI * 0.5); // 90°
    destCtx.translate(
      -destCtx.canvas.width * 0.5,
      -destCtx.canvas.height * 0.5,
    );
  };

  const discardSelect = () => {
    // If has active object
    disableDrawingMode();
    if (fabricRef.current.getActiveObject()) {
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
      store.setModalOpen(false);
    } else {
      fabricRef.current.renderAll();
    }
  };

  const rotateScreen = () => {
    disableDrawingMode();
    const selectedRotation: any = Object.values(store.rotationList).find(
      (e: any) => e.name !== store.size.name,
    );

    fabricRef.current.setDimensions({
      width: selectedRotation.width,
      height: selectedRotation.height,
    });

    // when changing the logical orientation, reset the viewport scale and update base size
    baseCanvasSizeRef.current = {
      width: selectedRotation.width,
      height: selectedRotation.height,
    };
    currentScaleRef.current = 1;
    fabricRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);

    fabricRef.current.getObjects().forEach(function (obj) {
      obj.set(
        "left",
        obj.left - (store.size.width - selectedRotation.width) / 2,
      );
      obj.set(
        "top",
        obj.top - (store.size.height - selectedRotation.height) / 2,
      );
      obj.setCoords(); // Update the coordinates
    });
    store.form.setValue("meta.orientation", selectedRotation.name);
  };

  // Snap rotation to increments and strong cardinal angles
  const snapRotation = (angleDeg: number, step = 15, strongThreshold = 7) => {
    if (angleDeg === undefined || angleDeg === null) return angleDeg;
    // normalize to 0-360
    const a = ((angleDeg % 360) + 360) % 360;

    const strongAngles = [0, 90, 180, 270];
    for (const s of strongAngles) {
      const diff = Math.min(Math.abs(a - s), 360 - Math.abs(a - s));
      if (diff <= strongThreshold) return s;
    }

    // snap to nearest step
    const snapped = Math.round(a / step) * step;
    return snapped;
  };

  const hex = (h) => {
    return h
      .replace(
        /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
        (_, r, g, b) => "#" + r + r + g + g + b + b,
      )
      .substring(1)
      .match(/.{2}/g)
      .map((x) => parseInt(x, 16));
  };

  const generatePreview = async ({
    useFastPreviewAnalysis = previewDitheringSettings.useFastPreviewAnalysis,
    skipUnneededPreviewSuggestions =
      previewDitheringSettings.skipUnneededPreviewSuggestions,
    useAcceleratedPreviewProcessing =
      previewDitheringSettings.useAcceleratedPreviewProcessing,
  }: GeneratePreviewOptions = {}) => {
    const timings: Record<string, number> = {};
    const totalStartedAt = getPreviewPerformanceNow();

    let stepStartedAt = getPreviewPerformanceNow();
    discardSelect();
    recordPreviewTiming(timings, "discardSelection", stepStartedAt);

    stepStartedAt = getPreviewPerformanceNow();
    await resizeCanvas({
      width: store.size.width,
      height: store.size.height,
      enableRetinaScaling: false,
      imageSmoothingEnabled: false,
      source: "generatePreview",
    });
    recordPreviewTiming(timings, "resizeCanvas", stepStartedAt);

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = previewCanvasRef.current.width;
    sourceCanvas.height = previewCanvasRef.current.height;

    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) return;

    stepStartedAt = getPreviewPerformanceNow();
    sourceCtx.drawImage(
      canvasRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height,
    );
    recordPreviewTiming(timings, "copySourceCanvas", stepStartedAt);

    const previewCtx = previewCanvasRef.current.getContext("2d");
    if (!previewCtx) return;

    stepStartedAt = getPreviewPerformanceNow();
    previewCtx.clearRect(
      0,
      0,
      previewCanvasRef.current.width,
      previewCanvasRef.current.height,
    );
    recordPreviewTiming(timings, "clearPreviewCanvas", stepStartedAt);
    // wait 2 seconds to ensure the canvas is rendered
    //await new Promise((resolve) => setTimeout(resolve, 2000));
    //await canvasToDither({ ref: previewCanvasRef });

    const suggestionIsNeeded =
      previewDitheringSettings.useAutoProcessing &&
      !previewDitheringSettings.autoSettingsEdited;
    const shouldSuggestProcessing = skipUnneededPreviewSuggestions
      ? suggestionIsNeeded
      : true;
    let previewAnalysisSize: CanvasSize | null = null;
    let previewAnalysisCanvas: HTMLCanvasElement | null = sourceCanvas;

    if (shouldSuggestProcessing && useFastPreviewAnalysis) {
      previewAnalysisSize = getFastPreviewCanvasSize(
        sourceCanvas.width,
        sourceCanvas.height,
        {
          mode: "fast",
          maxLongEdge: FAST_PREVIEW_MAX_LONG_EDGE,
        },
      );

      if (previewAnalysisSize) {
        stepStartedAt = getPreviewPerformanceNow();
        previewAnalysisCanvas = createScaledPreviewSourceCanvas(
          sourceCanvas,
          previewAnalysisSize,
        );
        recordPreviewTiming(timings, "scaleAutoAnalysisCanvas", stepStartedAt);
      }
    }

    if (!previewAnalysisCanvas) return;

    const suggestion = shouldSuggestProcessing
      ? (() => {
          stepStartedAt = getPreviewPerformanceNow();
          const nextSuggestion = suggestCanvasProcessingOptions(
            previewAnalysisCanvas,
            aitjcizeSpectra6Palette,
            {
              intent: previewDitheringSettings.autoIntent,
            },
          );
          recordPreviewTiming(timings, "autoAnalysis", stepStartedAt);
          return nextSuggestion;
        })()
      : undefined;
    const suggestionSource = getPreviewSuggestionSettingsSource(suggestion);
    const effectivePreviewDitheringSettings =
      suggestionIsNeeded &&
      previewDitheringSettings.autoSettingsSource !== suggestionSource
        ? applyDitherOptionsToPreviewSettings({
            settings: previewDitheringSettings,
            options: suggestion?.ditherOptions,
            source: suggestionSource,
          })
        : previewDitheringSettings;

    if (effectivePreviewDitheringSettings !== previewDitheringSettings) {
      setPreviewDitheringSettings?.(effectivePreviewDitheringSettings);
    }

    const ditherOptions = buildPreviewDitherOptions(
      {
        ...effectivePreviewDitheringSettings,
        useFastPreviewAnalysis,
        skipUnneededPreviewSuggestions,
        useAcceleratedPreviewProcessing,
      },
      suggestion,
    );

    stepStartedAt = getPreviewPerformanceNow();
    await ditherImage(sourceCanvas, previewCanvasRef.current, {
      ...ditherOptions,
      palette: aitjcizeSpectra6Palette,
    });
    recordPreviewTiming(timings, "ditherImage", stepStartedAt);

    const renderCtx = renderCanvasRef.current.getContext("2d");
    if (!renderCtx) return;

    stepStartedAt = getPreviewPerformanceNow();
    if (store.size.name === "portrait") {
      renderCtx.translate(store.size.height / 2, store.size.width / 2);
      renderCtx.rotate(90 * (Math.PI / 180));

      renderCtx.drawImage(
        previewCanvasRef.current,
        -previewCanvasRef.current.width / 2,
        -previewCanvasRef.current.height / 2,
        previewCanvasRef.current.width,
        previewCanvasRef.current.height,
      );

      renderCtx.rotate(-90 * (Math.PI / 180));
      renderCtx.translate(-store.size.height / 2, -store.size.width / 2);
    } else {
      renderCtx.translate(store.size.width / 2, store.size.height / 2);

      // OpenPaper13 landscape already matches the physical orientation.
      const rotationAngleLandscape =
        store.selectedFrameKind === "openpaper13" ? 0 : 180;
      renderCtx.rotate(rotationAngleLandscape * (Math.PI / 180));

      renderCtx.drawImage(
        previewCanvasRef.current,
        -previewCanvasRef.current.width / 2,
        -previewCanvasRef.current.height / 2,
        previewCanvasRef.current.width,
        previewCanvasRef.current.height,
      );

      renderCtx.rotate(-rotationAngleLandscape * (Math.PI / 180));
      renderCtx.translate(-store.size.width / 2, -store.size.height / 2);
    }
    recordPreviewTiming(timings, "renderOutputCanvas", stepStartedAt);

    stepStartedAt = getPreviewPerformanceNow();
    replaceColors(
      renderCanvasRef.current,
      renderCanvasRef.current,
      aitjcizeSpectra6Palette,
    );
    recordPreviewTiming(timings, "replaceRenderColors", stepStartedAt);
    recordPreviewTiming(timings, "totalPreviewGeneration", totalStartedAt);

    const outputSize = {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    };

    const previewDebugInfo = buildPreviewDebugInfo({
      settings: effectivePreviewDitheringSettings,
      effectiveOptions: ditherOptions,
      suggestion,
      sourceCanvas,
      processingSize: {
        analysis: previewAnalysisSize || outputSize,
        dithering: outputSize,
        output: outputSize,
      },
      previewOptimizations: {
        useFastPreviewAnalysis,
        skipUnneededPreviewSuggestions,
        useBlobPreviewImages: previewDitheringSettings.useBlobPreviewImages,
        useAcceleratedPreviewProcessing,
      },
      timingsMs: timings,
    });

    setPreviewDebugInfo?.(previewDebugInfo);
    return previewDebugInfo;
  };

  async function resizeCanvas({
    width,
    height,
    enableRetinaScaling = true,
    imageSmoothingEnabled = false,
    source: _source = "none",
  }: any) {
    void _source;
    if (!fabricRef.current) return;
    const containerWidth = width || wrapperRef?.current?.offsetWidth || 500;
    const containerHeight = height || wrapperRef?.current?.offsetHeight || 500;

    fabricRef.current.imageSmoothingEnabled = imageSmoothingEnabled;
    fabricRef.current.enableRetinaScaling = enableRetinaScaling;

    // compute scale relative to the original logical (unscaled) canvas size
    const baseWidth =
      baseCanvasSizeRef.current.width || fabricRef.current.getWidth();
    const baseHeight =
      baseCanvasSizeRef.current.height || fabricRef.current.getHeight();

    const aspectRatio = baseWidth / baseHeight;

    let newContainerWidth = containerWidth;
    let newContainerHeight = newContainerWidth / aspectRatio;

    // If height is too tall, shrink based on height instead
    if (newContainerHeight > containerHeight) {
      newContainerHeight = containerHeight;
      newContainerWidth = newContainerHeight * aspectRatio;
    }

    const scale = newContainerWidth / baseWidth;

    // set new canvas DOM dimensions (still preserve aspect ratio)
    fabricRef.current.setDimensions({
      width: Math.round(baseWidth * scale),
      height: Math.round(baseHeight * scale),
    });

    // Apply a single viewport transform instead of rescaling every object.
    // This prevents cumulative scaling when resize/rotate is called repeatedly.
    fabricRef.current.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    currentScaleRef.current = scale;
    fabricRef.current.renderAll();
  }

  const openPreviewImage = async (previewState = true) => {
    if (isLoadingImageData) return;
    const generatedDebugInfo = (await generatePreview()) as
      | PreviewDitheringDebugInfo
      | undefined;

    setPreview(previewState);

    const imageEncodingStartedAt = getPreviewPerformanceNow();
    const img = previewDitheringSettings.useBlobPreviewImages
      ? await canvasToObjectUrl(previewCanvasRef.current)
      : previewCanvasRef.current.toDataURL("image/png");
    const previewImageEncodingMs = roundTimingMs(
      getPreviewPerformanceNow() - imageEncodingStartedAt,
    );

    if (img) {
      revokePreviewImageObjectUrl();
      if (previewDitheringSettings.useBlobPreviewImages) {
        previewImageObjectUrlRef.current = img;
      }
      setPreviewImage(img);
    }

    if (generatedDebugInfo) {
      const previewDebugInfo = {
        ...generatedDebugInfo,
        previewOptimizations: {
          ...generatedDebugInfo.previewOptimizations,
          useBlobPreviewImages: previewDitheringSettings.useBlobPreviewImages,
        },
        timingsMs: {
          ...generatedDebugInfo.timingsMs,
          previewImageEncoding: previewImageEncodingMs,
        },
      };

      console.log("Preview debug info", previewDebugInfo);
      setPreviewDebugInfo?.(previewDebugInfo);
    }

    resizeCanvas({});
  };

  const getCanvasSize = () => {
    const viewportScale = currentScaleRef?.current || 1;
    const baseWidth = baseCanvasSizeRef?.current?.width;
    const baseHeight = baseCanvasSizeRef?.current?.height;

    const canvas = fabricRef.current;

    const canvasWidth =
      baseWidth || (viewportScale ? canvas.getWidth() / viewportScale : 0);
    const canvasHeight =
      baseHeight || (viewportScale ? canvas.getHeight() / viewportScale : 0);
    return { width: canvasWidth, height: canvasHeight };
  };

  return {
    setCurrentObjectActive,
    prepareDrawingBrush,
    enableDrawingMode,
    disableDrawingMode,
    toggleDrawingMode,
    disposeFabric,
    canvasImage,
    handlePasteAnywhere,
    handleDragOverAnywhere,
    handleDropAnywhere,
    discardSelect,
    snapRotation,
    rotateCanvas,
    hex,
    rotateScreen,
    isLoadingImageData,
    getCanvasSize,
    setIsLoadingImageData,
    setActiveObject,
    isQrObject,
    addQrCodeObject,
    addImageFromUrl,
    addImageFileAsEditorElement,
    updateQrCodeObject,
    generatePreview,
    activeObject,
    resizeCanvas,
    openPreviewImage,
  };
}
