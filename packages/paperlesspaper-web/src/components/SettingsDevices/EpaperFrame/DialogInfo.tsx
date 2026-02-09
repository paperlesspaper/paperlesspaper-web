import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/sharp-solid-svg-icons";
import React from "react";
import styles from "./dialogInfo.module.scss";

interface DialogInfoProps {
  heading: string;
  text: string;
}

export default function DialogInfo({ heading, text }: DialogInfoProps) {
  return (
    <div className={styles.frame}>
      <div className={styles.frameInside}>
        <div className={styles.qrCode}>
          <FontAwesomeIcon icon={faQrcode} />
        </div>
        <h4>{heading}</h4>
        <p>{text}</p>
      </div>
    </div>
  );
}
