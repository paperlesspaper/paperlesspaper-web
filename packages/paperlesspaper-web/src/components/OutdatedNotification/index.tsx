import React from "react";
import { Capacitor } from "@capacitor/core";
import styles from "./styles.module.scss";
import { Trans, useTranslation } from "react-i18next";

export default function OutdatedNotification({ appInfo, setClose }: any) {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.name}>
        v{import.meta.env.REACT_APP_VERSION}{" "}
        <a onClick={() => setClose(true)} href="#">
          <Trans>Close</Trans>
        </a>
      </div>
      <iframe
        title={t("Outdated message")}
        src={`${appInfo?.data?.outdatedUrl}?version=${
          import.meta.env.REACT_APP_VERSION
        }&plattform=${Capacitor.getPlatform()}status=outdated&app=true`}
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}
