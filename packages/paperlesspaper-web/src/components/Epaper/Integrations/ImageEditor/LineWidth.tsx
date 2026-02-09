import { faRuler } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import ValueChanger from "./ValueChanger";
import { useImageEditorContext } from "./ImageEditor";

const ModalComponent = () => {
  const {
    brushWidth = 4,
    setBrushWidth,
    fabricRef,
  }: any = useImageEditorContext();

  const getActivePath = () => {
    const active = fabricRef?.current?.getActiveObject?.();
    return active?.type === "path" ? active : null;
  };

  const initialWidth = getActivePath()?.strokeWidth || brushWidth || 4;

  const handleChange = (e) => {
    const width = parseFloat(e.target.value) || 1;

    setBrushWidth?.(width);

    if (fabricRef?.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.width = width;
    }

    const path = getActivePath();
    if (path) {
      path.set("strokeWidth", width);
      fabricRef.current.requestRenderAll();
    }
  };

  return (
    <ValueChanger
      defaultValue={initialWidth}
      min="1"
      max="40"
      step="1"
      onChange={handleChange}
    >
      <Trans>Line width</Trans>
    </ValueChanger>
  );
};

export default function LineWidth() {
  return (
    <EditorButton
      id="lineWidth"
      kind="secondary"
      text={<Trans>Line width</Trans>}
      icon={<FontAwesomeIcon icon={faRuler} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
