import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { InlineLoading } from "@progressiveui/react";
import { Trans } from "react-i18next";

import styles from "./styles.module.scss";

type OverlayLoadingProps = {
  description?: React.ReactNode;
  fullscreen?: boolean;
};

export default function OverlayLoading({
  description = <Trans>Loading...</Trans>,
  fullscreen = false,
}: OverlayLoadingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const overlayClass = fullscreen
    ? `${styles.overlay} ${styles.fullscreen}`
    : styles.overlay;

  const overlay = (
    <div className={overlayClass}>
      <div className={styles.overlayInner}>
        <InlineLoading description={description} />
      </div>
    </div>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(overlay, document.body);
}
