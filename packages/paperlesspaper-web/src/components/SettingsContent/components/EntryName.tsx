import React from "react";
import { useSettingsContent } from "../SettingsContentContext";

export const EntryName = () => {
  const { entryName } = useSettingsContent();
  return <>{entryName}</>;
};
