import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TextInput } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import useEditor from "./useEditor";
import ValueChanger from "./ValueChanger";
import { fabric } from "fabric";
import styles from "./colorSelect.module.scss";
import { faSun } from "@fortawesome/pro-regular-svg-icons";
import { useImageEditorContext } from "./ImageEditor";

const ModalComponent = () => {
  const { form }: any = useEditor();

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
          5,

          new fabric.Image.filters.Brightness({
            brightness: 0,
          })
        );

        applyFilterValue(5, "brightness", parseFloat(e.target.value));
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
