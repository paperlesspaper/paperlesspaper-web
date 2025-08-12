import React from "react";
import WikipediaDesign from "./WikipediaDesign";
import RotateScreen from "../../Fields/RotateScreen";
import DeletePaper from "../ImageEditor/DeletePaper";

export default function WikipediaEditorElements() {
  return (
    <>
      <WikipediaDesign />
      <RotateScreen />
      <DeletePaper />
    </>
  );
}
