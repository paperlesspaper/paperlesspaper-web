import React from "react";
import Avatar from "components/Avatar";
import styles from "./styles.module.scss";
import UserMeta from "components/UserMeta";
import classnames from "classnames";

export default function UserDetails({ className, user }: any) {
  const classes = classnames(styles.userDetails, className);

  if (!user) return null;
  return (
    <div className={classes}>
      <Avatar user={user} kind="large" className={styles.avatar} />
      <div>
        <h3 className={styles.name}>
          {user.meta?.firstName} {user.meta?.lastName}
        </h3>
        <div className={styles.meta}>
          <p className={styles.metaAddress}>
            <UserMeta user={user} />
          </p>
        </div>
      </div>
    </div>
  );
}
