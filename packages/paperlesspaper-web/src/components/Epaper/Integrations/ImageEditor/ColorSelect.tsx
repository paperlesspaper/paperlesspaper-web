import React from "react";
import styles from "./colorSelect.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFill } from "@fortawesome/pro-regular-svg-icons";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import { useImageEditorContext } from "./ImageEditor";

function ModalComponent() {
  const { colors, setLastColor, lastColor, fabricRef, imageEditorTools }: any =
    useImageEditorContext();
  const changeColor = (color) => {
    setLastColor(color);

    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = color;
    }

    const activeObject = fabricRef.current?.getActiveObject?.();
    if (activeObject?.type === "path") {
      activeObject.set({
        stroke: color,
        fill: "",
      });
    } else if (activeObject) {
      activeObject.set("fill", color);
    } else if (imageEditorTools?.activeObject?.type === "drawing") {
      imageEditorTools.prepareDrawingBrush?.();
    }

    fabricRef.current?.renderAll();
  };

  if (!colors) return null;

  return (
    <div>
      <div className={styles.colors}>
        {colors.map((d, i) => (
          <div
            key={i}
            className={`${styles.color} ${lastColor === d ? styles.active : ""}`}
            style={{ backgroundColor: d }}
            onClick={() => changeColor(d)}
          ></div>
        ))}
      </div>
    </div>
  );
}

export default function ColorSelect() {
  return (
    <EditorButton
      id="color"
      kind="secondary"
      text={<Trans>Color</Trans>}
      icon={<FontAwesomeIcon icon={faFill} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
