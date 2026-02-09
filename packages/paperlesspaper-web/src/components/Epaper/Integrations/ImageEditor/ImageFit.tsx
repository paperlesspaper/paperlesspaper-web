import React from "react";
import { Trans } from "react-i18next";
import { fabric } from "fabric";
import EditorButton from "./EditorButton";
import { useImageEditorContext } from "./ImageEditor";
import styles from "./fontStyles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownLeftAndUpRightToCenter,
  faMaximize,
  faPercent,
  faUpRightAndDownLeftFromCenter,
} from "@fortawesome/pro-regular-svg-icons";

type FitMode = "contain" | "cover" | "half";

const getRotatedBoundingSize = (
  width: number,
  height: number,
  angleDeg: number,
) => {
  const angle = ((angleDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const rotatedWidth = Math.abs(width * cos) + Math.abs(height * sin);
  const rotatedHeight = Math.abs(width * sin) + Math.abs(height * cos);

  return {
    width: rotatedWidth || 1,
    height: rotatedHeight || 1,
  };
};

const getCoverScaleForRotatedRect = (
  frameWidth: number,
  frameHeight: number,
  rectWidth: number,
  rectHeight: number,
  angleDeg: number,
) => {
  const w = rectWidth || 1;
  const h = rectHeight || 1;
  const theta = ((angleDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const x = (frameWidth || 0) / 2;
  const y = (frameHeight || 0) / 2;
  const corners: Array<[number, number]> = [
    [x, y],
    [x, -y],
    [-x, y],
    [-x, -y],
  ];

  let requiredScale = 0;
  corners.forEach(([cx, cy]) => {
    // Transform frame corner into the image's unrotated local axes
    const u = Math.abs(cx * cos + cy * sin);
    const v = Math.abs(-cx * sin + cy * cos);

    requiredScale = Math.max(requiredScale, (2 * u) / w, (2 * v) / h);
  });

  return requiredScale || 1;
};

const getNaturalSize = (img: fabric.Image) => {
  const anyImg: any = img as any;
  const el: any = anyImg?._originalElement || anyImg?._element;

  const width = el?.naturalWidth || el?.width || img.width || 1;
  const height = el?.naturalHeight || el?.height || img.height || 1;

  return { width, height };
};

export default function ImageFit() {
  const { fabricRef, baseCanvasSizeRef, currentScaleRef }: any =
    useImageEditorContext();

  const applyFit = (mode: FitMode) => {
    const canvas = fabricRef?.current;
    if (!canvas) return;

    const viewportScale = currentScaleRef?.current || 1;
    const baseWidth = baseCanvasSizeRef?.current?.width;
    const baseHeight = baseCanvasSizeRef?.current?.height;

    // Objects live in the logical (unscaled) canvas coordinate space.
    // The DOM canvas is resized and then a viewportTransform is applied.
    // So we must compute in logical units for centering and scaling.
    const canvasWidth =
      baseWidth || (viewportScale ? canvas.getWidth() / viewportScale : 0);
    const canvasHeight =
      baseHeight || (viewportScale ? canvas.getHeight() / viewportScale : 0);

    const activeObjects = canvas.getActiveObjects?.() || [];
    const targets = activeObjects.length
      ? activeObjects
      : [canvas.getActiveObject?.()].filter(Boolean);

    targets.forEach((obj: any) => {
      if (!obj || obj.type !== "image") return;

      const img = obj as fabric.Image;
      const { width: naturalWidth, height: naturalHeight } =
        getNaturalSize(img);

      const angle = (img as any)?.angle || 0;
      const { width: rotatedWidth, height: rotatedHeight } =
        getRotatedBoundingSize(naturalWidth, naturalHeight, angle);

      // Reset cropping to show full image when switching fit modes.
      img.set({
        cropX: 0,
        cropY: 0,
        width: naturalWidth,
        height: naturalHeight,
        originX: "center",
        originY: "center",
      });

      const containScale = Math.min(
        canvasWidth / rotatedWidth,
        canvasHeight / rotatedHeight,
      );
      const coverScale = getCoverScaleForRotatedRect(
        canvasWidth,
        canvasHeight,
        naturalWidth,
        naturalHeight,
        angle,
      );

      let scale = containScale;
      let offsetY = 0;

      if (mode === "cover") {
        // Avoid sub-pixel gaps on the bottom edge by intentionally over-covering
        // vertically by 1px and then shifting the image down by 0.5px.
        const extraBottomPx = 1;
        const coverScaleMinY = rotatedHeight
          ? (canvasHeight + extraBottomPx) / rotatedHeight
          : coverScale;
        scale = Math.max(coverScale, coverScaleMinY);
        offsetY = extraBottomPx / 2;
      } else if (mode === "half") {
        scale = containScale * 0.5;
      }

      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2 + offsetY,
        scaleX: scale,
        scaleY: scale,
      });

      img.setCoords();
    });

    canvas.renderAll();
  };

  const ModalComponent = () => (
    <div className={styles.fontStyles}>
      <EditorButton
        id="imageFitContain"
        key="imageFitContain"
        kind="secondary"
        onClick={() => applyFit("contain")}
        text={<Trans>Contain</Trans>}
        icon={<FontAwesomeIcon icon={faDownLeftAndUpRightToCenter} />}
      />
      <EditorButton
        id="imageFitCover"
        key="imageFitCover"
        kind="secondary"
        onClick={() => applyFit("cover")}
        text={<Trans>Cover</Trans>}
        icon={<FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} />}
      />
      <EditorButton
        id="imageFitHalf"
        key="imageFitHalf"
        kind="secondary"
        onClick={() => applyFit("half")}
        text={<Trans>50%</Trans>}
        icon={<FontAwesomeIcon icon={faPercent} />}
      />
    </div>
  );

  return (
    <EditorButton
      id="imageFit"
      kind="secondary"
      text={<Trans>Size</Trans>}
      icon={<FontAwesomeIcon icon={faMaximize} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
