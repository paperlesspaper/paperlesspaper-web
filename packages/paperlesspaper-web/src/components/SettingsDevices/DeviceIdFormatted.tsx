import { deviceKindHasFeature } from "helpers/devices/deviceList";
import React from "react";
import { Trans } from "react-i18next";
import styles from "./deviceIdFormatted.module.scss";

export default function DeviceIdFormatted({ children, title, kind }: any) {
  if (deviceKindHasFeature("analog", kind)) return <Trans>analog device</Trans>;

  if (!children) return <Trans>No deviceId found</Trans>;
  if (kind === "objectId" && children) {
    return (
      <span className={styles.name}>
        {title && (
          <>
            <Trans>{title}</Trans>{" "}
          </>
        )}
        {children}
      </span>
    );
  }
  const deviceIdSplit = children.split("-");

  const joy = deviceIdSplit[1].match(/.{1,3}/g);

  return (
    <span className={styles.name}>
      {title && (
        <>
          <Trans>{title}</Trans>{" "}
        </>
      )}
      {deviceIdSplit[0]}-
      {joy.map((e, i) => (
        <span key={i}>{e}</span>
      ))}
    </span>
  );
}
