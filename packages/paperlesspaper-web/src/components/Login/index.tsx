import React from "react";
import { Button, BlockNotification, InlineLoading } from "@progressiveui/react";
import { Redirect } from "react-router-dom";
import { Trans } from "react-i18next";
import {
  hiddenLoadingWithResetState,
  useSyncLoadingWithResetState,
} from "@internetderdinge/web";

import styles from "./login.module.scss";

import useAccount from "helpers/useAccount";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import useQs from "helpers/useQs";
import { useLoadingWithResetContext } from "components/AuthWrapper/AuthRouter";
import LoginImage from "./LoginImage";
import AuthFailure from "components/AuthWrapper/AuthFailure";
import { getLoginReturnTo } from "helpers/authRecovery";
import i18n from "translation/i18n";
import { languageToAuth0 } from "translation/languages";

const Login = () => {
  const account = useAccount();
  const {
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    isRecovering,
    authProblem,
    reduxToken,
    loginWithRedirect,
    logout,
    user,
  } = account;
  const { setLoadingWithResetState } = useLoadingWithResetContext();

  const { pathname = "" }: any = useQs();
  const isProcessingLogin =
    !authProblem && (isLoading || isDelayedLoading || isRecovering);
  const loginProcessingMessage = isDelayedLoading ? (
    <Trans>Authorization is getting processed</Trans>
  ) : (
    <Trans>You will be redirected</Trans>
  );

  useSyncLoadingWithResetState({
    isVisible: isProcessingLogin,
    setLoadingWithResetState,
    title: <Trans>Processing login</Trans>,
    message: loginProcessingMessage,
  });

  React.useEffect(() => {
    if (!isProcessingLogin) {
      setLoadingWithResetState(hiddenLoadingWithResetState);
    }
  }, [isProcessingLogin, setLoadingWithResetState]);

  const login = (authorizationParams, appState?) =>
    loginWithRedirect({ authorizationParams, appState });

  if (authProblem) return <AuthFailure />;

  if (!isProcessingLogin && isAuthenticated && reduxToken) {
    return <Redirect to={getLoginReturnTo()} />;
  }

  if (isProcessingLogin) return null;

  return (
    <LoginWrapper rightSide={<LoginImage />}>
      <div className={styles.form}>
        <LoginWrapperTitle>
          <span>paperlesspaper</span>
        </LoginWrapperTitle>
        <p className={styles.description}>
          {pathname.includes("invite") ? (
            <BlockNotification kind="warning">
              <Trans>Please register first to accept the invitation.</Trans>
            </BlockNotification>
          ) : (
            <Trans>Please login or sign up.</Trans>
          )}
        </p>
        {!isLoading && !user ? (
          <div className={styles.buttonWrapper}>
            <Button
              id="signupButton"
              onClick={() =>
                login({
                  screen_hint: "signup",
                  ui_locales: languageToAuth0(i18n.language), // "de", //i18n.language.split("-")[0],
                })
              }
            >
              <Trans>New Account</Trans>
            </Button>
            <Button
              id="loginButton"
              kind="tertiary"
              onClick={() =>
                login(
                  {
                    ui_locales: languageToAuth0(i18n.language), // "de", //i18n.language.split("-")[0],
                  },
                  {
                    returnTo: pathname || getLoginReturnTo(),
                  }
                )
              }
            >
              <Trans>Login</Trans>
            </Button>
          </div>
        ) : (
          <InlineLoading />
        )}
        {!isLoading && user && (
          <>
            <div>
              <div>
                <Trans>Already logged in as</Trans> {user.name}
              </div>
              <Button
                onClick={() => logout(/*{ returnTo: window.location.origin }*/)}
              >
                <Trans>Sign Out</Trans>
              </Button>
            </div>
          </>
        )}
      </div>
    </LoginWrapper>
  );
};

export default Login;
