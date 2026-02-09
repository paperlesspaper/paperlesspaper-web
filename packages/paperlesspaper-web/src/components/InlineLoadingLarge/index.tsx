import React from "react";
import { InlineLoading } from "@progressiveui/react";
import styles from "./styles.module.scss";

export default function InlineLoadingLarge(props) {
  return (
    <div className={styles.inlineLoadingWrapper}>
      <InlineLoading {...props} className={styles.inlineLoading} />
    </div>
  );
}
