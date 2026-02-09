import React from "react";
import styles from "./styles.module.scss";
import classnames from "classnames";

export default function NotificationIcon({
  // condition,
  status,
  icon,
  ...other
}: any) {
  // const deviceKind = messageKinds[condition];

  const classes = classnames(styles.deviceIcon, {
    [`${styles.unread}`]: status === "unread",
    [`${styles.read}`]: status === "read",
  });

  return (
    <div {...other} className={classes}>
      {/*<FontAwesomeIcon icon={faCircle} className={styles.status} />*/}
      {icon && icon}
      {/*<FontAwesomeIcon
        icon={deviceKind?.icon}
        className={styles.deviceIconImage}
  />*/}
    </div>
  );
}
