import React from "react";
import { Button, BlockNotification, InlineLoading } from "@progressiveui/react";
import { Redirect, useLocation } from "react-router-dom";
import { Trans } from "react-i18next";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import styles from "./login.module.scss";

import useAccount from "helpers/useAccount";
import Empty from "components/Empty";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import useQs from "helpers/useQs";
import LoginImage from "./LoginImage";
import i18n from "translation/i18n";
import { languageToAuth0 } from "translation/languages";

const Login = () => {
  const location = useLocation();
  const account = useAccount();
  const {
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    loginWithRedirect,
    logout,
    user,
  } = account;

  const { pathname }: any = useQs();

  const login = async (authorizationParams, appState?) => {
    const options = { authorizationParams, appState };

    if (Capacitor.isNativePlatform()) {
      await loginWithRedirect({
        ...options,
        openUrl: async (url) => {
          await Browser.open({ url });
        },
      });
    } else {
      loginWithRedirect(options);
    }
  };

  if (!isDelayedLoading && isAuthenticated) {
    return (
      <Redirect
        to={{
          pathname: "/",
        }}
      />
    );
  }

  if (isDelayedLoading) {
    return (
      <Empty
        kind="large"
        icon={
          <div>
            <InlineLoading />
          </div>
        }
        title={<Trans>Processing login</Trans>}
      >
        <Trans>Authorization is getting processed</Trans>
      </Empty>
    );
  }

  if (location.search.includes("code=")) {
    return (
      <Empty
        kind="large"
        icon={
          <div>
            <InlineLoading />
          </div>
        }
        title={<Trans>Processing login</Trans>}
      >
        <Trans>You will be redirected</Trans>
      </Empty>
    );
  }

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
                    returnTo: `${pathname}`,
                  },
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
