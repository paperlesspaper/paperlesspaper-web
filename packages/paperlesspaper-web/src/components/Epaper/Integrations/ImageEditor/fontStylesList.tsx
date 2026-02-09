import React from "react";
import styles from "./fontStyles.module.scss";

const fontStyles = {
  simple: {
    name: "Simple",
    icon: <span className={styles.simple}>T</span>,
    settings: {
      fontFamily: "Open Sans",
      textAlign: "center",
      fontWeight: "bold",
    },
  },
  light: {
    name: "Light",
    icon: <span className={styles.light}>T</span>,
    settings: {
      fontFamily: "Open Sans",
      textAlign: "center",
      fontWeight: "normal",
    },
  },
  extrabold: {
    name: "Extra Bold",
    icon: <span className={styles.extrabold}>T</span>,
    settings: {
      fontFamily: "Open Sans",
      textAlign: "center",
      fontWeight: "800",
    },
  },
  condensed: {
    name: "Condensed",
    icon: <span className={styles.condensed}>T</span>,
    settings: {
      fontFamily: "Open Sans Condensed",
      textAlign: "center",
      fontWeight: "bold",
    },
  },
  serif: {
    name: "Serif",
    icon: <span className={styles.serif}>T</span>,
    settings: {
      fontFamily: "Apple Garamond",
      textAlign: "center",
      fontWeight: "normal",
    },
  },
  monospace: {
    name: "Monospace",
    icon: <span className={styles.courier}>T</span>,
    settings: {
      fontFamily: "Courier New",
      textAlign: "center",
      fontWeight: "bold",
    },
  },
};

export default fontStyles;
