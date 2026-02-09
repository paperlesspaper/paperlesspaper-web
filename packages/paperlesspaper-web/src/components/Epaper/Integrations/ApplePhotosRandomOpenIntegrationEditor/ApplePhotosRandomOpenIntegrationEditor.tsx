import React from "react";
import OpenIntegrationEditor from "../OpenIntegrationEditor/OpenIntegrationEditor";

const CONFIG_URL =
  "https://apps.paperlesspaper.de/apple-photos-random/config.json";

export default function ApplePhotosRandomOpenIntegrationEditor() {
  return <OpenIntegrationEditor defaultPluginConfigUrl={CONFIG_URL} />;
}
