import React from "react";

import styles from "./formRow.module.scss";
import { Row } from "react-flexbox-grid";

export default function FormRow({ children }: any) {
  return <Row className={styles.row}>{children}</Row>;
}
