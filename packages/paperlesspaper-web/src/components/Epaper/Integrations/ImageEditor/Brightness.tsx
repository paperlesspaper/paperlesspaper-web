import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import ValueChanger from "./ValueChanger";
import * as fabric from "fabric";
import { faSun } from "@fortawesome/pro-regular-svg-icons";
import { useImageEditorContext } from "./ImageEditor";

const ModalComponent = () => {
  const { fabricRef }: any = useImageEditorContext();

  function getActiveImage() {
    const obj = fabricRef.current?.getActiveObject?.();
    if (!obj || obj.type !== "image") return null;
    obj.filters ||= [];
    return obj;
  }

  function findBrightnessFilter() {
    const obj = getActiveImage();
    return (
      obj?.filters?.find((filter: any) => filter?.type === "Brightness") ?? null
    );
  }

  function getCurrentBrightness() {
    return findBrightnessFilter()?.brightness?.toString() ?? "0";
  }

  return (
    <ValueChanger
      defaultValue={getCurrentBrightness()}
      min="-0.5"
      max="0.5"
      step="0.02"
      onChange={(e) => {
        const obj = getActiveImage();
        if (!obj) return;

        let filter = findBrightnessFilter();
        if (!filter) {
          filter = new fabric.filters.Brightness({
            brightness: 0,
          });
          obj.filters.push(filter);
        }

        filter.brightness = parseFloat(e.target.value);
        obj.applyFilters();
        fabricRef.current.renderAll();
      }}
    >
      <Trans>Brightness</Trans>
    </ValueChanger>
  );
};

export default function Brightness() {
  return (
    <EditorButton
      id="brightness"
      kind="secondary"
      text={<Trans>Brightness</Trans>}
      icon={<FontAwesomeIcon icon={faSun} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
