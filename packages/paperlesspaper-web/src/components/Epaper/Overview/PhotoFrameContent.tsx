import { Empty, InlineLoading } from "@progressiveui/react";
import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./photoFrame.module.scss";

type PhotoFrameContentProps = {
  currentImageUrl?: string;
  debugImageUrl?: string;
  deviceIsLoading: boolean;
  showDebugImage: boolean;
  showLoadingOverlay: boolean;
  showLoadingPlaceholder: boolean;
};

export default function PhotoFrameContent({
  currentImageUrl,
  debugImageUrl,
  deviceIsLoading,
  showDebugImage,
  showLoadingOverlay,
  showLoadingPlaceholder,
}: PhotoFrameContentProps) {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const [debugImageError, setDebugImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [currentImageUrl]);

  useEffect(() => {
    setDebugImageError(false);
  }, [debugImageUrl]);

  if (showLoadingPlaceholder) {
    return (
      <div className={styles.loadingImage}>
        <InlineLoading description={<Trans>Loading image...</Trans>} />
      </div>
    );
  }

  if (!deviceIsLoading && !currentImageUrl) {
    return (
      <div className={styles.noImage}>
        <h3>
          <Trans>No image</Trans>
        </h3>
        <p>
          <Trans>Please upload a first picture</Trans>
        </p>
        <NewEntryButton
          className={styles.addButton}
          icon={<AddIcon />}
          kind="primary"
          small={false}
          iconReverse={false}
        >
          <Trans>New picture</Trans>
        </NewEntryButton>
      </div>
    );
  }

  if (imageError) {
    return (
      <Empty title={<Trans>Image not loaded</Trans>}>
        <Trans>Failed loading the image</Trans>
      </Empty>
    );
  }

  if (!currentImageUrl) return null;

  return (
    <>
      {showDebugImage && debugImageUrl && !debugImageError && (
        <img
          src={debugImageUrl}
          alt={t("Device-rendered e-paper image")}
          className={styles.debugImage}
          onError={() => setDebugImageError(true)}
        />
      )}
      <img
        src={currentImageUrl}
        alt={t("Preview of the e-paper display")}
        className={styles.displayImage}
        onError={() => setImageError(true)}
      />
      {showLoadingOverlay && (
        <div className={styles.loadingOverlay}>
          <InlineLoading description={<Trans>Updating...</Trans>} />
        </div>
      )}
    </>
  );
}
