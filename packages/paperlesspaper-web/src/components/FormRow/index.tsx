import React from "react";

import styles from "./formRow.module.scss";

export default function FormRow({ children }: any) {
  return <div className={styles.row}>{children}</div>;
}
