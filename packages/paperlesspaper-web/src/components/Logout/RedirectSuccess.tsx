import React from "react";
import Empty from "../Empty";
import { useLocation } from "react-router-dom";
import styles from "./logout.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import qs from "qs";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import email from "./email.svg";
import { Button } from "@progressiveui/react";

export default function RedirectSuccess() {
  const location = useLocation();

  const { message, success } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });

  return (
    <Empty
      className={styles.logout}
      title={<Trans>{message ? message : "No message"}</Trans>}
      kind="large"
      icon={<img src={email} alt="Email" className={styles.emailIcon} />}
    >
      {success === "false" && (
        <Button
          href={`${import.meta.env.REACT_APP_SERVER_WEBSITE_URL}/posts`}
          kind="secondary"
        >
          <Trans>Help & Support</Trans>
        </Button>
      )}

      <ButtonRouter to="/" icon={<FontAwesomeIcon icon={faChevronRight} />}>
        <Trans>Continue</Trans>
      </ButtonRouter>
    </Empty>
  );
}
