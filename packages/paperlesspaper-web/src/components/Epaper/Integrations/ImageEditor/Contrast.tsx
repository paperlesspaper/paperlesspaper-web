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

  function getActiveImage() {
    const obj = fabricRef.current?.getActiveObject?.();
    if (!obj || obj.type !== "image") return null;
    obj.filters ||= [];
    return obj;
  }

  function findContrastFilter() {
    const obj = getActiveImage();
    return (
      obj?.filters?.find((filter: any) => filter?.type === "Contrast") ?? null
    );
  }

  function getCurrentContrast() {
    return findContrastFilter()?.contrast?.toString() ?? "0";
  }

  return (
    <ValueChanger
      defaultValue={getCurrentContrast()}
      min="-0.5"
      max="0.5"
      step="0.02"
      onChange={(e) => {
        const obj = getActiveImage();
        if (!obj) return;

        let filter = findContrastFilter();
        if (!filter) {
          filter = new fabric.filters.Contrast({
            contrast: 0,
          });
          obj.filters.push(filter);
        }

        filter.contrast = parseFloat(e.target.value);
        obj.applyFilters();
        fabricRef.current.renderAll();
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
