import { useActiveUserDevice } from "helpers/useUsers";
import { useState } from "react";
import * as fabric from "fabric";

import {
  clampQrPixelSize,
  generateQrPngDataUrl,
  type QrCodeConfig,
} from "./qrCodeUtils";

import {
  colorsMap,
  colorsSlightlyReal,
} from "../../../SettingsDevices/EpaperDisplay";

import { ditherImage, replaceColors } from "epdoptimize";
import { colorsSpectra6, colorsSpectra6Native } from "./ImageEditor";

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
}: any) {
  const [activeObject, setActiveObject] = useState(null);
  const activeDevice = useActiveUserDevice();

  const [isLoadingImageData, setIsLoadingImageData] = useState(false);

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

      await new Promise<void>((resolve) => {
        if (typeof obj.setSrc === "function") {
          obj.setSrc(dataUrl, () => resolve());
        } else {
          resolve();
        }
      });

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
      fabricRef.current.requestRenderAll?.();
    } finally {
      obj.__updatingQr = false;
    }
  };

  const addQrCodeObject = async (config: QrCodeConfig) => {
    if (!fabricRef?.current) return;

    const sizePx = clampQrPixelSize(512);
    const dataUrl = await generateQrPngDataUrl({ config, sizePx });

    await new Promise<void>((resolve) => {
      fabric.Image.fromURL(dataUrl, function (img: any) {
        img.set({
          left: (store?.size?.width || 600) / 2 - 120,
          top: (store?.size?.height || 448) / 2 - 120,
          lockUniScaling: true,
          centeredScaling: true,
          memoElementType: "qr",
          qrConfig: config,
          qrPixelSize: sizePx,
        });

        img.scaleToWidth(240);
        fabricRef.current.add(img).setActiveObject(img).renderAll();
        setActiveObject(img);
        resolve();
      });
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
    fabricRef.current.dispose();
  };

  // Fabric.js image function
  const canvasImage = (url) => {
    const img = new fabric.Image(url);
    img.set({
      left: 0,
      top: 0,
    });
    img.scaleToWidth(store.size.width);

    fabric.Image.fromURL(url, function (img) {
      fabricRef.current.add(img);
    });
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
    canvasImage(imageURL);
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
      fabricRef.current.discardActiveObject().renderAll();
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

    fabricRef.current.setHeight(selectedRotation.height);
    fabricRef.current.setWidth(selectedRotation.width);

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

  const generatePreview = async () => {
    discardSelect();

    await resizeCanvas({
      width: store.size.width,
      height: store.size.height,
      enableRetinaScaling: false,
      imageSmoothingEnabled: false,
      source: "generatePreview",
    });

    const previewCtx = previewCanvasRef.current.getContext("2d");
    previewCtx.drawImage(
      canvasRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height,
    );
    // wait 2 seconds to ensure the canvas is rendered
    //await new Promise((resolve) => setTimeout(resolve, 2000));
    //await canvasToDither({ ref: previewCanvasRef });

    const ditherColors =
      activeDevice.data?.kind === "epd7" ? colorsSpectra6 : colorsSlightlyReal;
    const nativeColors =
      activeDevice.data?.kind === "epd7" ? colorsSpectra6Native : colorsMap;

    console.log("ditherColors", ditherColors, replaceColors);

    const options = {
      errorDiffusionMatrix: "floydSteinberg",
      ditheringType: "errorDiffusion",
      palette: ditherColors,
      /*  activeDevice.data?.kind === "epd7"
            ? getDeviceColors("spectra6")
            : colors */
    };

    await ditherImage(
      previewCanvasRef.current,
      previewCanvasRef.current,
      options,
    );

    const renderCtx = renderCanvasRef.current.getContext("2d");

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
      renderCtx.rotate(180 * (Math.PI / 180));

      renderCtx.drawImage(
        previewCanvasRef.current,
        -previewCanvasRef.current.width / 2,
        -previewCanvasRef.current.height / 2,
        previewCanvasRef.current.width,
        previewCanvasRef.current.height,
      );

      renderCtx.rotate(-180 * (Math.PI / 180));
      renderCtx.translate(-store.size.width / 2, -store.size.height / 2);
    }

    replaceColors(renderCanvasRef.current, renderCanvasRef.current, {
      originalColors: ditherColors,
      replaceColors: nativeColors,
    });
  };

  async function resizeCanvas({
    width,
    height,
    enableRetinaScaling = true,
    imageSmoothingEnabled = false,
    source: _source = "none",
  }: any) {
    void _source;
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
    await generatePreview();

    setPreview(previewState);

    const img = previewCanvasRef.current.toDataURL("image/png");
    setPreviewImage(img);

    resizeCanvas({});
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
    discardSelect,
    snapRotation,
    rotateCanvas,
    hex,
    rotateScreen,
    isLoadingImageData,
    setIsLoadingImageData,
    setActiveObject,
    isQrObject,
    addQrCodeObject,
    updateQrCodeObject,
    generatePreview,
    activeObject,
    resizeCanvas,
    openPreviewImage,
  };
}
