import React, { useEffect } from "react";
import { Button } from "@progressiveui/react";
import { AnimatePresence, motion } from "framer-motion";
import { Trans } from "react-i18next";
import styles from "./ImagePreviewOverlay.module.scss";

export type ImagePreviewData = {
  url: string;
  alt: string;
  onEdit?: () => void;
};

type ImagePreviewOverlayProps = {
  preview: ImagePreviewData | null;
  onClose: () => void;
};

export default function ImagePreviewOverlay({
  preview,
  onClose,
}: ImagePreviewOverlayProps) {
  useEffect(() => {
    if (!preview) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [preview, onClose]);

  return (
    <AnimatePresence>
      {preview ? (
        <motion.div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={preview.alt}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={styles.previewModal}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <img
              src={preview.url}
              alt={preview.alt}
              className={styles.previewModalImage}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
            />

            {preview.onEdit ? (
              <div className={styles.previewActions}>
                <Button onClick={preview.onEdit} kind="primary">
                  <Trans>Edit</Trans>
                </Button>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
