import { useAuth0 } from "@auth0/auth0-react";
import { getAuthToken } from "ducks/auth";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as Sentry from "@sentry/react";
import authDuck from "ducks/auth";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import useAppIdentifier from "./useAppIdentifier";
import { Device } from "@capacitor/device";
import { devicesNotificationsApi } from "ducks/devicesNotificationsApi";

export default function useAccount() {
  const printToken = localStorage.getItem("print-token");

  const auth0Context = useAuth0();
  const appIdentifier = useAppIdentifier();

  const [isDelayedLoading, setIsDelayedLoading] = useState(true);

  const [removeDeviceToken, removeDeviceTokenResult] =
    devicesNotificationsApi.useRemoveDeviceTokenMutation();

  const {
    isLoading,
    isAuthenticated,
    /*token, */ user,
    handleRedirectCallback,
  } = auth0Context;

  // TODO: Check if this is still needed
  const token = false;

  const handleRedirectCallbackInternal = async (url) => {
    await auth0Context.handleRedirectCallback(url);
    const token = await auth0Context.getIdTokenClaims();

    setTokenSync(token?.__raw);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  useEffect(() => {
    CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (
        url.includes("state") &&
        (url.includes("code") || url.includes("error"))
      ) {
        await handleRedirectCallbackInternal(url);
      }
      if (Capacitor.getPlatform() === "ios") await Browser.close();
      await getToken();
    });
  }, [handleRedirectCallback]);

  const setTokenSync = (token) => {
    dispatch(authDuck.actions.setTokenSync(token));
  };

  const getToken = async () => {
    console.log("Getting token...");
    try {
      const result = await auth0Context.getAccessTokenSilently();
      console.log("Token result:", result);
    } catch (e) {
      console.log("error", e);
    }

    const idTokenClaims = await auth0Context.getIdTokenClaims();

    console.log("ID Token Claims:", idTokenClaims);

    if (idTokenClaims) setTokenSync(idTokenClaims.__raw);
  };

  /*useEffect(() => {
    const interval = setInterval(() => {
      getToken();
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);*/

  const logout = async () => {
    const deviceId = await Device.getId();

    removeDeviceToken({
      values: {
        deviceId: deviceId.identifier,
        plattform: Capacitor.getPlatform(),
      },
    });
  };

  const logoutEffect = async () => {
    if (Capacitor.isNativePlatform()) {
      await auth0Context.logout({
        logoutParams: {
          returnTo: `${appIdentifier}://auth.wirewire.de/capacitor/${appIdentifier}`,
        },
        openUrl: async (url) => {
          await Browser.open({ url });
        },
      });
      if (Capacitor.getPlatform() === "ios") await Browser.close();
      window.location.reload();
    } else {
      auth0Context.logout({
        logoutParams: {
          returnTo: import.meta.env.REACT_APP_AUTH_REDIRECT_URL,
        },
      });
    }
  };

  useEffect(() => {
    if (removeDeviceTokenResult.isSuccess === true) {
      logoutEffect();
    }
    getToken();
  }, [removeDeviceTokenResult.isSuccess]);

  useEffect(() => {
    getToken();
  }, [token]);

  useEffect(() => {
    /*if (isAuthenticated === false && isLoading === false) {
      history.push(
        `/login/${qs.stringify({ pathname: history.location.pathname })}`
      );
    }*/
  }, [isLoading, isAuthenticated]);

  const dispatch = useDispatch();

  const reduxToken = useSelector(getAuthToken);

  useEffect(() => {
    (async () => {
      if (isLoading === false) {
        // There's a race condition somewhere: the user is not authenticated immediately
        // See https://github.com/auth0/auth0-react/issues/343
        // TODO: Check if still needed
        await new Promise((r) => setTimeout(r, 500)); // sleeping 1s seems fine
        setIsDelayedLoading(false);
      } else {
        setIsDelayedLoading(true);
      }
    })();
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (user) Sentry.setUser({ name: user.name, email: user.email });
  }, [token]);

  const isAdmin =
    user &&
    user["https://memo.wirewire.de/roles"] &&
    user["https://memo.wirewire.de/roles"].includes("admin");

  const isDebug =
    user &&
    user["https://memo.wirewire.de/roles"] &&
    user["https://memo.wirewire.de/roles"].includes("debug");

  const isDigiHfMed =
    user &&
    user["https://memo.wirewire.de/organizations"] &&
    user["https://memo.wirewire.de/organizations"].includes("digihfmed");

  useEffect(() => {
    if (printToken) setTokenSync(printToken);
  }, []);

  if (printToken) {
    return {
      reduxToken,
      token: printToken,
      ...auth0Context,
      isLoading: false,
      isAuthenticated: true,
      isDelayedLoading,
      isAdmin,
      isDebug,
      isDigiHfMed,
      getToken,
      logout,
    };
  }

  return {
    reduxToken,
    token,
    ...auth0Context,
    isDelayedLoading,
    isAdmin,
    isDebug,
    isDigiHfMed,
    getToken,
    logout,
  };
}
