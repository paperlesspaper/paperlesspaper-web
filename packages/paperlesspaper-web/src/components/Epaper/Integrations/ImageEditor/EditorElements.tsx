import {
  faIcons,
  faPen,
  faQrcode,
  faRotate,
  faSquare,
  faText,
} from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fabric } from "fabric";
import React from "react";
import EditorButton from "./EditorButton";
import fontStylesList from "./fontStylesList";
import useEditor from "./useEditor";
import AddImage from "./AddImage";
import IconsListLazyWrapper from "../../Icons/IconsListLazyWrapper";
import { Trans } from "react-i18next";
import { useImageEditorContext } from "./ImageEditor";

export default function EditorElements() {
  const { fabricRef, lastColor, imageEditorTools }: any =
    useImageEditorContext();

  const { size, setModalOpen }: any = useEditor();

  const addText = () => {
    const rect = new fabric.Textbox("Text", {
      //id: currentId + 1,
      top: size.height / 2 - 25,
      left: size.width / 2 - 200,
      width: 400,
      height: 50,
      ...fontStylesList.simple.settings,
    });
    rect.setControlVisible("mt", false);
    rect.setControlVisible("mb", false);

    fabricRef.current.add(rect);
    imageEditorTools.setCurrentObjectActive();
  };

  const addRectangle = () => {
    const rect = new fabric.Rect({
      // id: currentId + 1,
      top: size.height / 2 - 50,
      left: size.width / 2 - 50,
      width: 100,
      height: 100,
      fill: lastColor /* colors[0]*/,
    });

    fabricRef.current.add(rect);

    imageEditorTools.setCurrentObjectActive();
  };

  const addQrCode = async () => {
    const config = {
      mode: "url",
      url: "https://",
      stylePreset: "classic",
      margin: 8,
      errorCorrectionLevel: "M",
    };

    await imageEditorTools.addQrCodeObject(config);
    setModalOpen?.("qrCodeSettings");
  };

  return (
    <>
      <AddImage />
      <EditorButton
        id="toggleDrawingMode"
        text={<Trans>Draw</Trans>}
        onClick={imageEditorTools.toggleDrawingMode}
        kind="secondary"
        // kind={activeObject?.type === "drawing" ? "primary" : "secondary"}
        icon={<FontAwesomeIcon icon={faPen} />}
      />

      <EditorButton
        id="addRectangle"
        text={<Trans>Rectangle</Trans>}
        onClick={addRectangle}
        kind="secondary"
        icon={<FontAwesomeIcon icon={faSquare} />}
      />
      <EditorButton
        id="addIcon"
        text="Icons"
        //  onClick={addIcon}
        kind="secondary"
        icon={<FontAwesomeIcon icon={faIcons} />}
        modalComponent={IconsListLazyWrapper}
        modalHeading={<Trans>Icons</Trans>}
      />
      <EditorButton
        id="addText"
        onClick={addText}
        kind="secondary"
        text={<Trans>Text</Trans>}
        icon={<FontAwesomeIcon icon={faText} />}
      />

      <EditorButton
        id="addQrCode"
        onClick={addQrCode}
        kind="secondary"
        text={<Trans>QR</Trans>}
        icon={<FontAwesomeIcon icon={faQrcode} />}
      />
      <EditorButton
        id="rotateScreen"
        onClick={imageEditorTools.rotateScreen}
        kind="secondary"
        text={<Trans>Rotate</Trans>}
        icon={<FontAwesomeIcon icon={faRotate} />}
      />
      {/* <LutFields /> */}
    </>
  );
}
