import ButtonRouter from "components/ButtonRouter";
import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./photoFrame.module.scss";
import type { DeviceSyncDisplayState } from "./photoFrameModel";

type PhotoFrameMetaProps = {
  distanceString: string;
  editTo: string;
  latestImageIsOnDevice: boolean;
  showDeviceStatus: boolean;
  status: DeviceSyncDisplayState;
  thumbnailUrl?: string;
};

function DeviceStatus({
  distanceString,
  status,
}: Pick<PhotoFrameMetaProps, "distanceString" | "status">) {
  if (status === "updating") {
    return (
      <div className={styles.nextSync}>
        <Trans>Updating now...</Trans>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className={styles.statusBlock}>
        <div className={styles.statusLine}>
          <div className={styles.nextSync}>
            <Trans i18nKey="DEVICE_OFFLINE_SINCE">
              Device offline since{" "}
              {{ NO_TRANSLATE_SYNC_VARIABLE: distanceString }}
            </Trans>
          </div>
        </div>
      </div>
    );
  }

  if (status === "current") {
    return (
      <div className={styles.statusBlock}>
        <div className={styles.statusLine}>
          <div className={styles.nextSyncTitle}>
            <Trans>Current Image</Trans>
          </div>
          <div className={styles.nextSync}>
            <Trans
              i18nKey="Next sync in {{nextSync}}."
              values={{ nextSync: distanceString }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className={styles.statusBlock}>
        <div className={styles.statusLine}>
          <div className={styles.nextSyncTitle}>
            <Trans>Next Image</Trans>
          </div>
          <div className={styles.nextSync}>
            <Trans i18nKey="IMAGE_UPDATED_AGO">
              Will be updated in{" "}
              {{ NO_TRANSLATE_SYNC_VARIABLE: distanceString }}
            </Trans>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.nextSync}>
      <Trans>Trying to sync...</Trans>
    </div>
  );
}

export default function PhotoFrameMeta({
  distanceString,
  editTo,
  latestImageIsOnDevice,
  showDeviceStatus,
  status,
  thumbnailUrl,
}: PhotoFrameMetaProps) {
  const { t } = useTranslation();
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    setThumbnailError(false);
  }, [thumbnailUrl]);

  return (
    <div className={styles.meta} data-navigation-end-spacing>
      <div className={styles.date}>
        {showDeviceStatus && (
          <div className={styles.metaLeft}>
            <DeviceStatus distanceString={distanceString} status={status} />
          </div>
        )}
      </div>

      <ButtonRouter
        withOrganization
        isPlain
        to={editTo}
        kind="primary"
        onTouchStartHandler={false}
      >
        <Trans>Edit</Trans>
      </ButtonRouter>

      {showDeviceStatus &&
        thumbnailUrl &&
        !thumbnailError &&
        !latestImageIsOnDevice && (
          <div className={styles.statusThumbnailRow}>
            <img
              src={thumbnailUrl}
              alt={t("Current image on the frame")}
              className={styles.statusThumbnail}
              onError={() => setThumbnailError(true)}
            />
            <div className={styles.statusThumbnailText}>
              <strong>
                <Trans>On the device now</Trans>
              </strong>
              <span>
                <Trans>This is what is on your device at the moment.</Trans>
              </span>
            </div>
          </div>
        )}
    </div>
  );
}
