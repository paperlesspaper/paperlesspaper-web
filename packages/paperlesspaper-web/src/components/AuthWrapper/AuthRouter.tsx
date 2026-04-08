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
}) => {
  const history = useHistory();
  useEffect(() => {
    if (isAuthenticated === false && isDelayedLoading === false) {
      const pathname = `${qs.stringify({
        pathname: history.location.pathname,
      })}`;

      history.push(`/login?${pathname}`);
    }
  }, [isAuthenticated, isLoading, isDelayedLoading]);
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
  const { isAuthenticated, isLoading, isDelayedLoading, reduxToken, getToken } =
    useAccount();
  useAppUrlListener();

  const showLoadingWithReset = isLoading || !reduxToken || !isAuthenticated;

  useSyncLoadingWithResetState({
    isVisible: showLoadingWithReset,
    setLoadingWithResetState,
    ...defaultLoadingWithResetText,
  });

  useLoginRedirect({
    isAuthenticated,
    isLoading,
    isDelayedLoading,
  });

  useAuthRedirect();

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
    // token,
    reduxToken,
    getToken,
  } = useAccount();
  useAppUrlListener();

  const showLoadingWithReset = isLoading || !reduxToken || !isAuthenticated;

  useSyncLoadingWithResetState({
    isVisible: showLoadingWithReset,
    setLoadingWithResetState,
    ...defaultLoadingWithResetText,
  });

  /*const loginRedirect =*/ useLoginRedirect({
    isAuthenticated,
    isLoading,
    isDelayedLoading,
  });

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
