import React from "react";
import DaysSinceDesign from "./DaysSinceDesign";
import RotateScreen from "../../Fields/RotateScreen";
import DeletePaper from "../ImageEditor/DeletePaper";

export default function WebsiteEditorElements() {
  return (
    <>
      <DaysSinceDesign />
      <RotateScreen />
      <DeletePaper />
    </>
  );
}
