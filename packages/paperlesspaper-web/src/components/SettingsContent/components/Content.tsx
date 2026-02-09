import React from "react";
import { Trans } from "react-i18next";
import { useSettingsContent } from "../SettingsContentContext";

export const Content = ({ children }: any) => {
  const { classes } = useSettingsContent();
  return <div className={classes}>{children}</div>;
};
