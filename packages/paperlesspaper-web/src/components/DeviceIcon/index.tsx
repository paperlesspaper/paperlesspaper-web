import React from "react";
import { deviceByKind } from "helpers/devices/deviceList";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareQuestion } from "@fortawesome/pro-light-svg-icons";
import styles from "./styles.module.scss";

export default function DeviceIcon({
  className,
  device = "unknown",
  ...other
}: any) {
  const deviceKind = deviceByKind(device);
  return (
    <div
      {...other}
      className={`${styles.deviceIcon} ${className ? className : ""}`}
    >
      {deviceKind?.image ? (
        <img
          alt={`Icon of the device ${deviceKind?.name}`}
          src={deviceKind?.image}
        />
      ) : (
        <FontAwesomeIcon
          icon={faSquareQuestion}
          className={styles.deviceIconImage}
        />
      )}
    </div>
  );
}
