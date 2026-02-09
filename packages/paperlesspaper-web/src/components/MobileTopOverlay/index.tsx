import React from "react";
import { Capacitor } from "@capacitor/core";
import styles from "./styles.module.scss";
import classnames from "classnames";

type MobileStatusOverlayProps = {
  kind?: "blue" | "background" | "layer";
};

export default function MobileStatusOverlay({
  kind = "layer",
}: MobileStatusOverlayProps) {
  if (Capacitor.isNativePlatform() || 1 === 1) {
    const classes = classnames(styles.overlay, {
      [styles[kind]]: kind,
    });

    return <div className={classes}></div>;
  }
  return null;
}
