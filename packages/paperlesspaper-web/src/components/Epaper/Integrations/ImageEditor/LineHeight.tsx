import { faLineHeight } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import ValueChanger from "./ValueChanger";
import { useImageEditorContext } from "./ImageEditor";

const ModalComponent = () => {
  const { fabricRef }: any = useImageEditorContext();

  return (
    <ValueChanger
      defaultValue="1"
      min="0.5"
      max="2"
      step="0.02"
      onChange={(e) => {
        fabricRef.current.getActiveObject().set("lineHeight", e.target.value);
        fabricRef.current.renderAll();
      }}
    >
      <Trans>Line height</Trans>
    </ValueChanger>
  );
};

export default function LineHeight() {
  return (
    <EditorButton
      id="contrast"
      kind="secondary"
      text={<Trans>Line height</Trans>}
      icon={<FontAwesomeIcon icon={faLineHeight} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
