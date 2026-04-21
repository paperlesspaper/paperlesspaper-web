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

  function getActiveImage() {
    const obj = fabricRef.current?.getActiveObject?.();
    if (!obj || obj.type !== "image") return null;
    obj.filters ||= [];
    return obj;
  }

  function findSaturationFilter() {
    const obj = getActiveImage();
    return (
      obj?.filters?.find((filter: any) => filter?.type === "Saturation") ??
      null
    );
  }

  function getCurrentSaturation() {
    return findSaturationFilter()?.saturation?.toString() ?? "0";
  }

  return (
    <ValueChanger
      defaultValue={getCurrentSaturation()}
      min="-1"
      max="1"
      step="0.02"
      onChange={(e) => {
        const obj = getActiveImage();
        if (!obj) return;

        let filter = findSaturationFilter();
        if (!filter) {
          filter = new fabric.filters.Saturation({
            saturation: 0,
          });
          obj.filters.push(filter);
        }

        filter.saturation = parseFloat(e.target.value);
        obj.applyFilters();
        fabricRef.current.renderAll();
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
