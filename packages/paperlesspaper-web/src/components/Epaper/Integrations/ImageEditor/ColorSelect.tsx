import React from "react";
import styles from "./colorSelect.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFill } from "@fortawesome/pro-regular-svg-icons";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import { useImageEditorContext } from "./ImageEditor";

function ModalComponent() {
  const { colors, setLastColor, lastColor, fabricRef }: any =
    useImageEditorContext();
  const changeColor = (color) => {
    setLastColor(color);
    fabricRef.current.getActiveObject().set("fill", color);
    fabricRef.current.renderAll();
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
