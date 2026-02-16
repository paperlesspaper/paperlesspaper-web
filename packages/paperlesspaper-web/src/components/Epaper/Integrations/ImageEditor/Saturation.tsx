import { faTint } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import ValueChanger from "./ValueChanger";
import * as fabric from "fabric";
import { useImageEditorContext } from "./ImageEditor";

const ModalComponent = () => {
  const { fabricRef }: any = useImageEditorContext();

  function applyFilter(index, filter) {
    const obj = fabricRef.current.getActiveObject();
    obj.filters[index] = filter;
    obj.applyFilters();
    fabricRef.current.renderAll();
  }

  function applyFilterValue(index, prop, value) {
    const obj = fabricRef.current.getActiveObject();
    if (obj.filters[index]) {
      obj.filters[index][prop] = value;
      obj.applyFilters();
      fabricRef.current.renderAll();
    }
  }

  return (
    <ValueChanger
      defaultValue="0"
      min="-1"
      max="1"
      step="0.02"
      onChange={(e) => {
        applyFilter(
          7,
          new fabric.Image.filters.Saturation({
            saturation: 0,
          }),
        );
        applyFilterValue(7, "saturation", parseFloat(e.target.value));
      }}
    >
      <Trans>Saturation</Trans>
    </ValueChanger>
  );
};

export default function Saturation() {
  return (
    <EditorButton
      id="saturation"
      kind="secondary"
      text={<Trans>Saturation</Trans>}
      icon={<FontAwesomeIcon icon={faTint} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
