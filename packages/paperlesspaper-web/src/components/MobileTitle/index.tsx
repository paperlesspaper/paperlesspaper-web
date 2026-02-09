import React from "react";
import classnames from "classnames";
import styles from "./styles.module.scss";

export function MobileTitle({ className, children }: any) {
  const classes = classnames(className, styles.mobileTitle);
  return <div className={classes}>{children}</div>;
}

export function MobileSubTitle({ className, children }: any) {
  const classes = classnames(className, styles.mobileSubTitle);
  return <div className={classes}>{children}</div>;
}
