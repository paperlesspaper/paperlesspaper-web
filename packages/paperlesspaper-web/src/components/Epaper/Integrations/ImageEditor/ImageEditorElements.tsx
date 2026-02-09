import React from "react";
import ActiveObject from "./ActiveObject";
import ColorSelect from "./ColorSelect";
import FontStyles from "./FontStyles";
import LineHeight from "./LineHeight";
import LineWidth from "./LineWidth";
import Brightness from "./Brightness";
import Contrast from "./Contrast";
import Saturation from "./Saturation";
import Clarity from "./Clarity";
import ImageFit from "./ImageFit";
import DeletePaper from "./DeletePaper";
import EditorElements from "./EditorElements";
import KeyboardControl from "./KeyboardControl";
import QrCodeSettings from "./QrCodeSettings";
import { useImageEditorContext } from "./ImageEditor";

function ImageActiveObjectTools() {
  const { imageEditorTools }: any = useImageEditorContext();

  if (imageEditorTools?.activeObject?.memoElementType === "qr") {
    return <QrCodeSettings />;
  }

  return (
    <>
      <ImageFit />
      <Brightness />
      <Contrast />
      <Saturation />
      <Clarity />
    </>
  );
}

export default function ImageEditorElements() {
  return (
    <>
      <ActiveObject type="rect">
        <ColorSelect />
      </ActiveObject>

      <ActiveObject type="textbox">
        <ColorSelect />
        <FontStyles />
        <LineHeight />
      </ActiveObject>

      <ActiveObject type="drawing">
        <ColorSelect />
        <LineWidth />
      </ActiveObject>

      <ActiveObject type="path">
        <ColorSelect />
        <LineWidth />
      </ActiveObject>

      <ActiveObject type="image">
        <ImageActiveObjectTools />
      </ActiveObject>

      <ActiveObject type="group" />

      <ActiveObject>
        <EditorElements />
        <DeletePaper />
      </ActiveObject>

      <KeyboardControl />
    </>
  );
}
