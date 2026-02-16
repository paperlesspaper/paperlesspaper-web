import React, { useEffect } from "react";
import Empty from "../Empty";
import { NavLink } from "react-router-dom";
import styles from "./logout.module.scss";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSmile } from "@fortawesome/pro-light-svg-icons";
import { useAuth0 } from "@auth0/auth0-react";

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
      title={/*message ? "Logout successfull" : */ "Logging out"}
      kind="large"
      icon={<FontAwesomeIcon icon={faSmile} />}
    >
      <NavLink to="login">Click here</NavLink> to login again.
    </Empty>
  );
}
