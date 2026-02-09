import React from "react";
import { Capacitor } from "@capacitor/core";
import styles from "./styles.module.scss";

export default function OutdatedNotification({ appInfo, setClose }: any) {
  return (
    <>
      <div className={styles.name}>
        v{import.meta.env.REACT_APP_VERSION}{" "}
        <a onClick={() => setClose(true)} href="#">
          Schließen
        </a>
      </div>
      <iframe
        title="Outdated message"
        src={`${appInfo?.data?.outdatedUrl}?version=${
          import.meta.env.REACT_APP_VERSION
        }&plattform=${Capacitor.getPlatform()}status=outdated&app=true`}
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}
