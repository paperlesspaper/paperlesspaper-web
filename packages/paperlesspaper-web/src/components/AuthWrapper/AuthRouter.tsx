import React, { useEffect } from "react";
import { Route } from "react-router-dom";
import { Loading } from "@progressiveui/react";
import useAccount from "helpers/useAccount";
import useAppUrlListener from "helpers/useAppUrlListener";
import { useLocation, useHistory } from "react-router-dom";
import qs from "qs";
import ErrorOverlay from "components/ErrorOverlay";

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
  const { isAuthenticated, isLoading, isDelayedLoading, reduxToken, getToken } =
    useAccount();
  useAppUrlListener();

  useLoginRedirect({
    isAuthenticated,
    isLoading,
    isDelayedLoading,
  });

  useAuthRedirect();

  if (isLoading || !reduxToken || !isAuthenticated) return <Loading />;

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
  const {
    isAuthenticated,
    isLoading,
    isDelayedLoading,
    // token,
    reduxToken,
    getToken,
  } = useAccount();
  useAppUrlListener();
  /*const loginRedirect =*/ useLoginRedirect({
    isAuthenticated,
    isLoading,
    isDelayedLoading,
  });

  // if (loginRedirect) return <Loading />;

  if (isLoading || !reduxToken || !isAuthenticated) return <Loading />;

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
