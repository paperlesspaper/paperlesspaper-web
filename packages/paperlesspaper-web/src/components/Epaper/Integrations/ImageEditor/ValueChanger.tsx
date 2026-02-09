import React from "react";
import styles from "./valueChanger.module.scss";

export default function ValueChanger({ children, ...other }: any) {
  return (
    <div className={styles.imageAdjust}>
      <div className={styles.alignment}>
        <div className={styles.alignmentTitle}>{children}</div>

        <input type="range" defaultValue="0" min="-1" max="1" {...other} />
      </div>
    </div>
  );
}
