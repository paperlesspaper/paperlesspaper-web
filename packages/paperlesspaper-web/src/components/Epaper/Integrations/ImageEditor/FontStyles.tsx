import React from "react";
import fontStyles from "./fontStylesList";
import styles from "./fontStyles.module.scss";
import EditorButton from "./EditorButton";
import { faFont } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Trans } from "react-i18next";
import {
  faAlignLeft,
  faAlignCenter,
  faAlignRight,
} from "@fortawesome/pro-regular-svg-icons";
import { useImageEditorContext } from "./ImageEditor";

function ModalComponent() {
  const { fabricRef }: any = useImageEditorContext();

  const changeFontStyle = (fontStyle) => {
    fabricRef.current.getActiveObject().set(fontStyle);
    fabricRef.current.renderAll();
  };

  const alignText = (align) => {
    fabricRef.current.getActiveObject().set("textAlign", align);
    fabricRef.current.renderAll();
  };

  return (
    <div className={styles.fontStyles}>
      {Object.entries(fontStyles).map(([i, d]: any) => (
        <EditorButton
          id={i}
          key={i}
          style={d.settings}
          text={d.name}
          onClick={() => changeFontStyle(d.settings)}
          icon={d.icon}
        />
      ))}

      <EditorButton
        id="align-left"
        key="align-left"
        text={<Trans>Left</Trans>}
        onClick={() => alignText("left")}
        icon={<FontAwesomeIcon icon={faAlignLeft} />}
      />

      <EditorButton
        id="align-center"
        key="align-center"
        text={<Trans>Center</Trans>}
        onClick={() => alignText("center")}
        icon={<FontAwesomeIcon icon={faAlignCenter} />}
      />

      <EditorButton
        id="align-right"
        key="align-right"
        text={<Trans>Right</Trans>}
        onClick={() => alignText("right")}
        icon={<FontAwesomeIcon icon={faAlignRight} />}
      />
    </div>
  );
}

export default function FontStyles() {
  return (
    <EditorButton
      id="font-styles"
      kind="secondary"
      text={<Trans>Style</Trans>}
      icon={<FontAwesomeIcon icon={faFont} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
