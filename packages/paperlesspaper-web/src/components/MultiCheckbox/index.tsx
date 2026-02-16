import React, { useEffect, useState } from "react";
import styles from "./styles.module.scss";
import { uniqueId } from "@progressiveui/react";
import classNames from "classnames";

/** Multicheckbox is a bigger checkbox next to each other */
const MultiCheckbox: any = React.forwardRef(
  (
    {
      className,
      icon,
      id,
      labelText,
      name,
      type = "checkbox",
      fullWidth,
      kind,
      description,
      mobile,
      ...other
    }: any,
    ref,
  ) => {
    const [calcId, setId] = useState();

    useEffect(() => {
      setId(id ? id : name + uniqueId());
    }, []);

    const classes = classNames(
      {
        [styles.fullWidth]: fullWidth,
        [styles.vertical]: kind === "vertical",
        [styles.mobileVertical]: mobile === "vertical",
      },
      styles.wrapper,
      className,
    );

    return (
      <div className={classes}>
        <input id={calcId} type={type} name={name} ref={ref} {...other} />
        <label htmlFor={calcId} className={styles.label}>
          <div className={styles.selector} />
          <span className={styles.labelText}>
            {labelText}
            {description && (
              <span className={styles.description}>{description}</span>
            )}
          </span>

          {icon && <span className={styles.icon}>{icon}</span>}
        </label>
      </div>
    );
  },
);

MultiCheckbox.displayName = "MultiCheckbox";

export default MultiCheckbox;
