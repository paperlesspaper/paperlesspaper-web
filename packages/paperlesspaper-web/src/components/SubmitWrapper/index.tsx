import React from "react";
import styles from "./styles.module.scss";
import classNames from "classnames";

export default function SubmitWrapper({
  children,
  kind = "left",
}: {
  children: React.ReactNode;
  kind?: "left" | "center";
}) {
  const classes = classNames(styles.submitWrapper, styles[kind]);
  return <div className={classes}>{children}</div>;
}
