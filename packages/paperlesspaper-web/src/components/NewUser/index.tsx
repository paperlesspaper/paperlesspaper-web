import React, { useState } from "react";
import { Button } from "@progressiveui/react";
import styles from "components/Login/login.module.scss";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";

import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import loginBackground from "components/Login/login-background.svg";
import { Trans } from "react-i18next";

export default function NewUser({ users }: any) {
  //TODO: Check
  const [formSubmitted, setFormSubmitted] = useState(false);
  const dispatch = useDispatch();
  const createUser = () => {
    setFormSubmitted(true);
    dispatch(users.actions.fetchCreateUser({}));
  };

  const newUserData = useSelector(users.selectors.newUserData);

  return (
    <>
      {newUserData && formSubmitted ? <Redirect to="/onboarding/new" /> : <></>}
      <LoginWrapper
        rightSide={
          <div className={styles.loginContent}>
            <img src={loginBackground} />
          </div>
        }
      >
        <div className={styles.form}>
          <LoginWrapperTitle>
            <span>Welcome</span>
            <br />
            <span>to the memo</span>
            <br />
            <span>medical app</span>
          </LoginWrapperTitle>

          <div className={styles.welcomeWrapper}>
            <Button onClick={createUser}>
              <Trans>Start using the app</Trans>
            </Button>
            <p className={styles.localLoginText}>
              <Trans>AGB_TEXT</Trans>
            </p>
          </div>
        </div>
      </LoginWrapper>
    </>
  );
}
