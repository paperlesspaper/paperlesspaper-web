import { useTheme } from "@progressiveui/react";
import React from "react";
import ReactJson from "react-json-view";

export default function JsonViewer(props: any) {
  const { actualTheme } = useTheme();
  //TODO: check rerender console.log("theme", actualTheme);
  return (
    <ReactJson
      collapsed
      theme={actualTheme === "dark" ? "shapeshifter" : "inverted"}
      {...props}
    />
  );
}
