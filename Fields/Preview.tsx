import React from "react";
import styles from "./preview.module.scss";

export default function Preview({ previewImage, previewImageRef }: any) {
  const [zoom, setZoom] = React.useState(false);
  return (
    <div
      className={`${styles.previewWrapper} ${
        zoom ? styles.zoomIn : styles.zoomOut
      }`}
    >
      <img
        alt="Preview for the epaper display"
        src={previewImage}
        className={styles.previewImage}
        ref={previewImageRef}
        onClick={() => setZoom(!zoom)}
      />
    </div>
  );
}
