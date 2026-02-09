import React from "react";
import styles from "./styles.module.scss";
import classnames from "classnames";

interface SettingsTitleProps {
  additional?: React.ReactNode;
  children: React.ReactNode;
  kind?: "subtitle";
  narrow?: boolean;
}

export default function SettingsTitle({
  additional,
  children,
  kind,
  narrow,
}: SettingsTitleProps) {
  const classes = classnames(styles.settingsTitle, {
    [`${styles.subTitle}`]: kind === "subtitle",
    [`${styles.narrow}`]: narrow,
  });

  return (
    <h2 className={classes}>
      {children}
      {additional}
    </h2>
  );
}
