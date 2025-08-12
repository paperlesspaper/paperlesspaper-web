import {
  faIcons,
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
import LutFields from "../../Fields/LutFields";
import IconsListLazyWrapper from "../../Icons/IconsListLazyWrapper";

export default function EditorElements() {
  const {
    rotateScreen,
    fabricRef,
    setCurrentObjectActive,
    size,
    lastColor,
  }: any = useEditor();

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
    setCurrentObjectActive();
  };

  const addRectangle = () => {
    const rect = new fabric.Rect({
      // id: currentId + 1,
      top: size.height / 2 - 50,
      left: size.width / 2 - 50,
      width: 100,
      height: 100,
      fill: lastColor,
    });

    fabricRef.current.add(rect);

    setCurrentObjectActive();
  };

  const addIcon = () => {
    const rect = new fabric.Rect({
      // id: currentId + 1,
      top: size.height / 2 - 25,
      left: size.width / 2 - 25,
      width: 50,
      height: 50,
      fill: lastColor,
    });

    fabricRef.current.add(rect);

    setCurrentObjectActive();
  };

  return (
    <>
      <AddImage />
      <EditorButton
        id="addRectangle"
        text="Rechteck"
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
      />
      <EditorButton
        id="addText"
        onClick={addText}
        kind="secondary"
        text="Text"
        icon={<FontAwesomeIcon icon={faText} />}
      />
      <EditorButton
        id="rotateScreen"
        onClick={rotateScreen}
        kind="secondary"
        text="Drehen"
        icon={<FontAwesomeIcon icon={faRotate} />}
      />
      <LutFields />
    </>
  );
}
