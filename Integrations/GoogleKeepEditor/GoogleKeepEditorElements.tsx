import { faRotate } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import LutFields from "../../Fields/LutFields";
import CssEditor from "../../Fields/CssEditor";
import GoogleKeepDesign from "./GoogleKeepDesign";
import DeletePaper from "../ImageEditor/DeletePaper";

export default function WebsiteEditorElements() {
  const { form, rotationList } = useEditor();
  const orientation = form.watch("meta.orientation");

  const rotateScreen = () => {
    const selectedRotation = Object.values(rotationList).find(
      (e) => e.name !== orientation
    );

    form.setValue("meta.orientation", selectedRotation.name);
  };

  return (
    <>
      <GoogleKeepDesign />
      <EditorButton
        id="rotate"
        onClick={rotateScreen}
        kind="secondary"
        text="Drehen"
        icon={<FontAwesomeIcon icon={faRotate} />}
      />
      <CssEditor />
      <LutFields />
      <DeletePaper />
    </>
  );
}
