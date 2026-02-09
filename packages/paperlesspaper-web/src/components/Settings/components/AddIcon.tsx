import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/sharp-solid-svg-icons";
import React from "react";
import styles from "./addIcon.module.scss";

export default function AddIcon() {
  return <FontAwesomeIcon icon={faPlus} className={styles.icon} />;
}
