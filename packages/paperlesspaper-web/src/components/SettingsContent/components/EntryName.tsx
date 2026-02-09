import React from "react";
import { Trans } from "react-i18next";
import { useSettingsContent } from "../SettingsContentContext";

export const EntryName = () => {
  const { entryName } = useSettingsContent();
  return <>{entryName}</>;
};
