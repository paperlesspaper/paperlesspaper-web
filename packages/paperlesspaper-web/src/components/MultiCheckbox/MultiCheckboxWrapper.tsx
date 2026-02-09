import React from "react";
import { Input } from "@progressiveui/react";
import styles from "./multiCheckboxWrapper.module.scss";
import classnames from "classnames";

export default function MultiCheckboxWrapper({
  children,
  className,
  mobile,
  kind,
  ...other
}: any) {
  const classes = classnames(
    {
      [styles.vertical]: kind === "vertical",
      [styles.mobileVertical]: mobile === "vertical",
    },
    styles.inputGroup,
    className
  );

  return (
    <Input {...other}>
      <div className={classes}>{children}</div>
    </Input>
  );
}
