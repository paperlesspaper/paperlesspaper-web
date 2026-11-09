import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Callout } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/pro-solid-svg-icons";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useLocaleDate } from "@internetderdinge/web";
import useAccount from "helpers/useAccount";
import formatDistanceShort from "helpers/formatDistanceShort";
import {
  dismissUploadNotice,
  getUploadNotice,
  subscribeUploadNotice,
} from "helpers/uploadNotice";
import { devicesApi } from "ducks/devices";
import { toValidDate } from "../Overview/photoFrameModel";
import styles from "./styles.module.scss";

export default function UploadNotice() {
  const accountId = useAccount().user?.sub;
  const { organization } = useParams<{ organization: string }>();
  const { t } = useTranslation();
  const { locale } = useLocaleDate();
  const notice = useSyncExternalStore(subscribeUploadNotice, () =>
    getUploadNotice(accountId),
  );
  const visible = Boolean(notice && notice.organization === organization);
  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    {
      skip: !visible || !notice?.frameIds.length,
      pollingInterval: visible ? 30000 : 0,
    },
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!visible) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(timer);
  }, [visible, notice]);
  if (!visible || !notice) return null;

  // Only use the actual destination's future wake-up time. Never borrow the
  // currently viewed frame's time or promise that a slideshow item appears next.
  const singleFrame = notice.frameIds.length === 1 && !notice.addedToSlideshow;
  const device =
    singleFrame && devices.data?.find((item) => item.id === notice.frameIds[0]);
  const nextSync = toValidDate(device?.deviceStatus?.nextDeviceSync);
  const nextSyncText =
    nextSync && nextSync.getTime() > now.getTime()
      ? formatDistanceShort(nextSync, now, locale)
      : null;

  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <Callout kind="success" title={<Trans>Image saved</Trans>}>
        {notice.frameIds.length > 0 && (
          <p>
            {notice.frameIds.length === 1 ? (
              <Trans>
                Your frame will download the image when it next wakes up.
              </Trans>
            ) : (
              <Trans>
                Your frames will download the image when they next wake up.
              </Trans>
            )}
          </p>
        )}
        {notice.addedToSlideshow && (
          <p>
            <Trans>
              The image was added to your slideshow and will appear according to
              its playback order.
            </Trans>
          </p>
        )}
        {!notice.frameIds.length && !notice.addedToSlideshow && (
          <p>
            <Trans>
              The image is saved in your library. Send it to a frame to display
              it.
            </Trans>
          </p>
        )}
        {nextSyncText && (
          <p>
            <strong>
              <Trans
                i18nKey="Expected in {{nextSync}}."
                values={{ nextSync: nextSyncText }}
              />
            </strong>
          </p>
        )}
        {(notice.frameIds.length > 0 || notice.addedToSlideshow) && (
          <p>
            <Trans>
              To fetch new content now, briefly press the button on the back of
              your frame.
            </Trans>
          </p>
        )}
      </Callout>
      <button
        type="button"
        className={styles.close}
        aria-label={t("Dismiss upload notice")}
        onClick={() => dismissUploadNotice(accountId)}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}
