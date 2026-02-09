import React, { useEffect, useRef } from "react";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import styles from "./success.module.scss";
import kiteIllustration from "./kite.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import SubmitWrapper from "components/SubmitWrapper";
import useQs from "helpers/useQs";
import { useHistory, useLocation } from "react-router-dom";

export default function Success() {
  const history = useHistory();
  const location = useLocation();
  const query = useQs();
  const queryRef = useRef(query);
  const { organization, skip } = queryRef.current;

  useEffect(() => {
    if (location.search) {
      history.replace({
        pathname: location.pathname,
        hash: location.hash,
      });
    }
  }, [history, location.hash, location.pathname, location.search]);

  useEffect(() => {
    const target = {
      pathname: location.pathname,
      hash: location.hash,
    };

    // Replace the current entry to drop the onboarding history state
    history.replace(target);

    // Push and replace once to ensure the back stack only contains this page
    history.push(target);
    history.replace(target);
  }, [history, location.hash, location.pathname]);

  return (
    <LoginWrapper
      rightSide={
        <img
          alt="Kite illustration"
          className={styles.image}
          src={kiteIllustration}
        />
      }
    >
      <LoginWrapperTitle kind="small">
        <Trans>Setup complete</Trans>
      </LoginWrapperTitle>

      <p className={styles.text}>
        {skip ? (
          <Trans>Setup completed. You can setup a device later.</Trans>
        ) : (
          <Trans>
            Setup completed. You can now add pictures to your paperlesspaper
            picture frame.
          </Trans>
        )}
      </p>

      <SubmitWrapper>
        <ButtonRouter
          large
          id="continueSuccessButton"
          to={`/${organization}/calendar`}
          icon={<FontAwesomeIcon icon={faChevronRight} />}
        >
          <Trans>Go to overview</Trans>
        </ButtonRouter>
      </SubmitWrapper>

      {/*<div className={styles.deviceAdd}>
        <SettingsDevicesNew />
    </div>*/}
    </LoginWrapper>
  );
}
