import React from "react";
import CalendarDesign from "./WeatherDesign";
import RotateScreen from "../../Fields/RotateScreen";
import DeletePaper from "../ImageEditor/DeletePaper";

export default function WeatherEditorElements() {
  return (
    <>
      <CalendarDesign />
      <RotateScreen />
      <DeletePaper />
    </>
  );
}
