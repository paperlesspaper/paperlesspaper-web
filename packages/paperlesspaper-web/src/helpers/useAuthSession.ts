import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0, type RedirectLoginOptions } from "@auth0/auth0-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useDispatch } from "react-redux";
import authDuck from "ducks/auth";
import {
  AUTH_TIMEOUT_MS,
  NATIVE_LOGIN_TIMEOUT_MS,
  type AuthProblem,
  claimAutomaticLogin,
  completeLogin,
  getLoginReturnTo,
  rememberLogin,
  requiresLogin,
  safeReturnTo,
  withAuthTimeout,
} from "./authRecovery";

export default function useAuthSession(printToken: string | null) {
  const auth0 = useAuth0();
  const dispatch = useDispatch();
  const [authProblem, setAuthProblem] = useState<AuthProblem | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const problemRef = useRef<AuthProblem | null>(null);
  const redirecting = useRef(false);
  const epoch = useRef(0);
  const tokenRequest = useRef<Promise<void> | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);
  const stopped = useRef(false);

  const showProblem = useCallback((problem: AuthProblem) => {
    if (!mounted.current) return;
    problemRef.current = problem;
    setAuthProblem(problem);
    setIsRecovering(false);
  }, []);
  const clearProblem = useCallback(() => {
    problemRef.current = null;
    setAuthProblem(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(redirectTimer.current);
    };
  }, []);

  const loginWithRedirect = useCallback(
    async (options: RedirectLoginOptions = {}) => {
      if (redirecting.current) return;
      stopped.current = false;
      redirecting.current = true;
      const attempt = ++epoch.current;
      tokenRequest.current = null;
      const returnTo = safeReturnTo(
        options.appState?.returnTo ?? getLoginReturnTo()
      );
      rememberLogin(returnTo);
      clearProblem();
      setIsRecovering(true);
      clearTimeout(redirectTimer.current);
      // loginWithRedirect can resolve without leaving the page (or after opening
      // the native browser). Bound that waiting state as well as SDK requests.
      redirectTimer.current = setTimeout(
        () => {
          if (attempt !== epoch.current) return;
          ++epoch.current;
          redirecting.current = false;
          showProblem({ kind: "login", retry: "login" });
        },
        Capacitor.isNativePlatform() ? NATIVE_LOGIN_TIMEOUT_MS : AUTH_TIMEOUT_MS
      );
      try {
        dispatch(authDuck.actions.logout());
        // Clear only this application's SDK cache, retaining the Auth0 SSO session
        // and unrelated local settings. Do not call the remote logout endpoint.
        await withAuthTimeout(auth0.logout({ openUrl: false }));
        if (attempt !== epoch.current || !mounted.current) return;
        await withAuthTimeout(
          auth0.loginWithRedirect({
            ...options,
            appState: { ...options.appState, returnTo },
            ...(Capacitor.isNativePlatform()
              ? {
                  openUrl: async (url: string) => {
                    await Browser.open({ url });
                  },
                }
              : {}),
          })
        );
      } catch {
        if (attempt !== epoch.current || !mounted.current) return;
        clearTimeout(redirectTimer.current);
        redirecting.current = false;
        showProblem({ kind: "login", retry: "login" });
      }
    },
    [auth0.logout, auth0.loginWithRedirect, clearProblem, dispatch, showProblem]
  );

  const recoverSession = useCallback(async () => {
    dispatch(authDuck.actions.logout());
    if (claimAutomaticLogin(getLoginReturnTo())) {
      await loginWithRedirect();
    } else {
      showProblem({ kind: "login", retry: "login" });
    }
  }, [dispatch, loginWithRedirect, showProblem]);

  const getToken = useCallback(
    (afterCallback = false): Promise<void> => {
      if (
        stopped.current ||
        printToken ||
        (!afterCallback && (auth0.isLoading || !auth0.isAuthenticated))
      ) {
        return Promise.resolve();
      }
      if (tokenRequest.current) return tokenRequest.current;
      if (redirecting.current) return Promise.resolve();
      const attempt = epoch.current;
      clearProblem();
      const request = (async () => {
        try {
          const accessToken = await withAuthTimeout(
            auth0.getAccessTokenSilently({
              authorizationParams: {
                audience:
                  import.meta.env.REACT_APP_AUTH0_AUDIENCE ?? "localhost:3000/",
                scope: "openid profile email offline_access",
              },
            })
          );
          if (attempt !== epoch.current || !mounted.current) return;
          if (!accessToken) throw new Error("No access token returned");
          dispatch(authDuck.actions.setTokenSync(accessToken));
          completeLogin();
          clearProblem();
        } catch (error) {
          if (attempt !== epoch.current || !mounted.current) return;
          if (requiresLogin(error)) await recoverSession();
          else showProblem({ kind: "connection", retry: "token" });
        }
      })();
      tokenRequest.current = request;
      void request.finally(() => {
        if (tokenRequest.current === request) tokenRequest.current = null;
      });
      return request;
    },
    [
      auth0.getAccessTokenSilently,
      auth0.isAuthenticated,
      auth0.isLoading,
      clearProblem,
      dispatch,
      printToken,
      recoverSession,
      showProblem,
    ]
  );

  useEffect(() => {
    if (
      stopped.current ||
      printToken ||
      redirecting.current ||
      problemRef.current
    )
      return;
    if (auth0.error) {
      const callback = new URLSearchParams(window.location.search);
      if (requiresLogin(auth0.error) && !callback.has("state"))
        void recoverSession();
      else if (
        callback.has("state") ||
        (auth0.error as { error?: string }).error
      ) {
        showProblem({ kind: "login", retry: "login" });
      } else showProblem({ kind: "connection", retry: "reload" });
    } else if (!auth0.isLoading && auth0.isAuthenticated) {
      void getToken();
    }
  }, [
    auth0.error,
    auth0.isLoading,
    auth0.isAuthenticated,
    getToken,
    printToken,
    recoverSession,
    showProblem,
  ]);

  useEffect(() => {
    if (!auth0.isLoading || printToken) return;
    const timer = setTimeout(() => {
      showProblem({ kind: "connection", retry: "reload" });
    }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [auth0.isLoading, printToken, showProblem]);

  const handleRedirectCallback = useCallback(
    async (url: string) => {
      if (stopped.current) return;
      clearTimeout(redirectTimer.current);
      const attempt = ++epoch.current;
      tokenRequest.current = null;
      redirecting.current = false;
      setIsRecovering(true);
      clearProblem();
      try {
        await withAuthTimeout(auth0.handleRedirectCallback(url));
        if (attempt !== epoch.current || !mounted.current) return;
        await getToken(true);
      } catch {
        if (attempt === epoch.current)
          showProblem({ kind: "login", retry: "login" });
      } finally {
        if (attempt === epoch.current && mounted.current)
          setIsRecovering(false);
      }
    },
    [auth0.handleRedirectCallback, clearProblem, getToken, showProblem]
  );

  const retryAuthentication = useCallback(async () => {
    if (problemRef.current?.retry === "reload") {
      window.location.reload();
    } else if (problemRef.current?.retry === "token") {
      await getToken();
    } else {
      await loginWithRedirect();
    }
  }, [getToken, loginWithRedirect]);

  const cancelPendingLogin = useCallback(() => {
    if (!redirecting.current) return;
    clearTimeout(redirectTimer.current);
    ++epoch.current;
    redirecting.current = false;
    showProblem({ kind: "login", retry: "login" });
  }, [showProblem]);

  const stopSession = useCallback(() => {
    stopped.current = true;
    ++epoch.current;
    tokenRequest.current = null;
    clearTimeout(redirectTimer.current);
    redirecting.current = false;
    dispatch(authDuck.actions.logout());
    completeLogin();
  }, [dispatch]);

  return {
    authProblem,
    isRecovering,
    getToken,
    loginWithRedirect,
    handleRedirectCallback,
    retryAuthentication,
    cancelPendingLogin,
    stopSession,
  };
}
