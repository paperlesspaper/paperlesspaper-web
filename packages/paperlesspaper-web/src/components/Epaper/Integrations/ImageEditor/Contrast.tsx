import { faCircleHalfStroke } from "@fortawesome/pro-regular-svg-icons";
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
      min="-0.5"
      max="0.5"
      step="0.02"
      onChange={(e) => {
        applyFilter(
          6,
          new fabric.filters.Contrast({
            contrast: 10,
          }),
        );

        applyFilterValue(6, "contrast", parseFloat(e.target.value));
      }}
    >
      <Trans>Contrast</Trans>
    </ValueChanger>
  );
};

export default function Contrast() {
  return (
    <EditorButton
      id="contrast"
      kind="secondary"
      text={<Trans>Contrast</Trans>}
      icon={<FontAwesomeIcon icon={faCircleHalfStroke} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}

/* 
import { fabric } from "fabric";
import React from "react";
import { Trans } from "react-i18next";
import useEditor from "./useEditor";
import ValueChanger from "./ValueChanger";

export default function Contrast() {
  const { fabricRef }: any = useEditor();
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
      min="-0.5"
      max="0.5"
      step="0.02"
      onChange={(e) => {
        applyFilter(
          6,
          new fabric.Image.filters.Contrast({
            contrast: 10,
          })
        );

        applyFilterValue(6, "contrast", parseFloat(e.target.value));
      }}
    >
      <Trans>Contrast</Trans>
    </ValueChanger>
  );
}
*/
