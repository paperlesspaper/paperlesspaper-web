import React, { useEffect } from "react";
import Empty from "../Empty";
import { NavLink } from "react-router-dom";
import styles from "./logout.module.scss";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSmile } from "@fortawesome/pro-light-svg-icons";
import { useAuth0 } from "@auth0/auth0-react";
import { Trans } from "react-i18next";

export default function Logout() {
  const { logout } = useAuth0();

  useEffect(() => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, []);

  return (
    <Empty
      className={styles.logout}
      title={<Trans>Logging out</Trans>}
      kind="large"
      icon={<FontAwesomeIcon icon={faSmile} />}
    >
      <NavLink to="login">
        <Trans>Click here</Trans>
      </NavLink>{" "}
      <Trans>to login again.</Trans>
    </Empty>
  );
}
