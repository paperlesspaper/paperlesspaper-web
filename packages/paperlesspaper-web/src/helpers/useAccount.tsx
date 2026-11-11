import { useAuth0 } from "@auth0/auth0-react";
import { getAuthToken } from "ducks/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import useAuthSession from "./useAuthSession";
import { useDispatch, useSelector } from "react-redux";
import * as Sentry from "@sentry/react";
import authDuck from "ducks/auth";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import useAppIdentifier from "./useAppIdentifier";
import { Device } from "@capacitor/device";
import { devicesNotificationsApi } from "ducks/devicesNotificationsApi";

function useAccountState() {
  const printToken = localStorage.getItem("print-token");

  const auth0Context = useAuth0();
  const appIdentifier = useAppIdentifier();

  const [isDelayedLoading, setIsDelayedLoading] = useState(true);

  const [removeDeviceToken] =
    devicesNotificationsApi.useRemoveDeviceTokenMutation();

  const session = useAuthSession(printToken);
  const { user } = auth0Context;
  const isLoading =
    !session.authProblem && (auth0Context.isLoading || session.isRecovering);
  const isAuthenticated = auth0Context.isAuthenticated;
  const token = false;
  const dispatch = useDispatch();
  const reduxToken = useSelector(getAuthToken);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener("appUrlOpen", async ({ url }) => {
      const callbackUrl = `${appIdentifier}://auth.wirewire.de/capacitor/${appIdentifier}/login`;
      if (!url.startsWith(`${callbackUrl}?`)) return;
      const query = new URL(url).searchParams;
      if (!query.has("state") || (!query.has("code") && !query.has("error")))
        return;
      await sessionRef.current.handleRedirectCallback(url);
      if (Capacitor.getPlatform() === "ios") await Browser.close();
    });
    const closed = Browser.addListener("browserFinished", () => {
      sessionRef.current.cancelPendingLogin();
    });
    return () => {
      void listener.then((handle) => handle.remove());
      void closed.then((handle) => handle.remove());
    };
  }, [appIdentifier]);

  const removeDeviceTokenBeforeLogout = async () => {
    try {
      const deviceId = await Device.getId();
      const result = removeDeviceToken({
        values: {
          deviceId: deviceId.identifier,
          plattform: Capacitor.getPlatform(),
        },
      });

      if (typeof result?.unwrap === "function") {
        await Promise.race([
          result.unwrap(),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      }
    } catch (error) {
      console.warn("logout: could not remove device token", error);
    }
  };

  const logout = async () => {
    await removeDeviceTokenBeforeLogout();
    session.stopSession();
    await logoutEffect();
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
      await auth0Context.logout({
        logoutParams: {
          returnTo: import.meta.env.REACT_APP_AUTH_REDIRECT_URL,
        },
      });
    }
  };

  useEffect(() => {
    if (isLoading) {
      setIsDelayedLoading(true);
      return;
    }
    const timer = setTimeout(() => setIsDelayedLoading(false), 500);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    Sentry.setUser(user ? { name: user.name, email: user.email } : null);
  }, [user]);

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
    if (printToken) dispatch(authDuck.actions.setTokenSync(printToken));
  }, [dispatch, printToken]);

  return {
    reduxToken,
    token: printToken || token,
    ...auth0Context,
    ...session,
    isLoading: printToken ? false : isLoading,
    isAuthenticated: printToken ? true : isAuthenticated,
    isDelayedLoading: printToken ? false : isDelayedLoading,
    isAdmin,
    isDebug,
    isDigiHfMed,
    logout,
  };
}

const AccountContext = createContext<ReturnType<typeof useAccountState> | null>(
  null
);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const account = useAccountState();
  return (
    <AccountContext.Provider value={account}>
      {children}
    </AccountContext.Provider>
  );
}

export default function useAccount() {
  const account = useContext(AccountContext);
  if (!account)
    throw new Error("useAccount must be used within AccountProvider");
  return account;
}
