import React from "react";
import styles from "./styles.module.scss";

export default function Wrapper({ children, editor, sidebar }: any) {
  return (
    <div className={styles.mainWrapper}>
      <div className={styles.sidebar}>{sidebar}</div>
      <div className={styles.editor}>{editor}</div>
      <div className={styles.wrapperContent}>{children}</div>
    </div>
  );
}
