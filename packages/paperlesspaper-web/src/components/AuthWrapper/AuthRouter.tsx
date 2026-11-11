import React, { useEffect } from "react";
import { Route } from "react-router-dom";
import {
  defaultLoadingWithResetText,
  LoadingWithResetProvider as SharedLoadingWithResetProvider,
  useLoadingWithResetContext,
  useSyncLoadingWithResetState,
} from "@internetderdinge/web";
import useAccount from "helpers/useAccount";
import useAppUrlListener from "helpers/useAppUrlListener";
import { useLocation, useHistory } from "react-router-dom";
import qs from "qs";
import ErrorOverlay from "components/ErrorOverlay";
import AuthFailure from "./AuthFailure";
import { Trans } from "react-i18next";

type LoadingWithResetProviderProps = {
  children: React.ReactNode;
};

export { useLoadingWithResetContext };

export const LoadingWithResetProvider = ({
  children,
}: LoadingWithResetProviderProps) => {
  const { logout } = useAccount();

  return (
    <SharedLoadingWithResetProvider
      onLogout={logout}
      resetDelayMs={3000}
      resetLabel={<Trans>Reset local data</Trans>}
      appVersion={import.meta.env.REACT_APP_VERSION}
    >
      {children}
    </SharedLoadingWithResetProvider>
  );
};

export const useLoginRedirect = ({
  isAuthenticated,
  isLoading,
  isDelayedLoading,
  authProblem = null,
}) => {
  const history = useHistory();
  useEffect(() => {
    if (
      !authProblem &&
      !isLoading &&
      isAuthenticated === false &&
      isDelayedLoading === false
    ) {
      const returnPath = `${history.location.pathname}${
        history.location.search || ""
      }${history.location.hash || ""}`;
      const pathname = `${qs.stringify({
        pathname: returnPath,
      })}`;

      history.replace(`/login?${pathname}`);
    }
  }, [isAuthenticated, isLoading, isDelayedLoading, authProblem, history]);
};

export default function useAuthRedirect() {
  const location = useLocation();
  const history = useHistory();

  const { success } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });

  // TODO: Check success is a boolean
  if (success === "true" || success === "false")
    history.push(`/redirectsuccess/${location.search}`);

  return null;
}

export const RouteWithRedirect = ({ component: Component, ...rest }: any) => {
  useAppUrlListener();
  return (
    <Route
      {...rest}
      render={(props) => {
        return <Component {...props} {...rest} />;
      }}
    />
  );
};

export const PrivateRouteWithOrganization = ({
  component: Component,
  ...rest
}: any) => {
  const { setLoadingWithResetState } = useLoadingWithResetContext();
  const {
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    reduxToken,
    getToken,
    authProblem,
  } = useAccount();
  useAppUrlListener();

  const showLoadingWithReset =
    !authProblem && (isLoading || !reduxToken || !isAuthenticated);

  useSyncLoadingWithResetState({
    isVisible: showLoadingWithReset,
    setLoadingWithResetState,
    ...defaultLoadingWithResetText,
  });

  useLoginRedirect({
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    authProblem,
  });

  useAuthRedirect();

  if (authProblem) return <AuthFailure />;
  if (showLoadingWithReset) return null;

  return (
    <Route
      {...rest}
      render={(props) => {
        return (
          <>
            <ErrorOverlay getToken={getToken} />
            <Component {...props} {...rest} />
          </>
        );

        /* return (
          <Redirect
            to={{
              pathname: "/login/",
              state: { from: props.location },
            }}
          />
        );*/
      }}
    />
  );
};

export const PrivateRoute = ({ component: Component, ...rest }: any) => {
  const { setLoadingWithResetState } = useLoadingWithResetContext();
  const {
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    authProblem,
    reduxToken,
    getToken,
  } = useAccount();
  useAppUrlListener();

  const showLoadingWithReset =
    !authProblem && (isLoading || !reduxToken || !isAuthenticated);

  useSyncLoadingWithResetState({
    isVisible: showLoadingWithReset,
    setLoadingWithResetState,
    ...defaultLoadingWithResetText,
  });

  /*const loginRedirect =*/ useLoginRedirect({
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    authProblem,
  });

  if (authProblem) return <AuthFailure />;
  if (showLoadingWithReset) return null;

  /*<Redirect
            to={{
              pathname: "/login/",
              state: { from: props.location },
            }}
          /> */

  return (
    <Route
      {...rest}
      render={(props) => (
        <>
          <ErrorOverlay getToken={getToken} />
          <Component {...props} {...rest} />
        </>
      )}
    />
  );
};
