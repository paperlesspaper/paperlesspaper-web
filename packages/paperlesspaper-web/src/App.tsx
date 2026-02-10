import React, { useState } from "react";
import "./scss/ui.scss";

import { Router, Route, Switch } from "react-router-dom";
import { createBrowserHistory } from "history";
import Login from "components/Login";
import Settings from "components/Settings";
import {
  PrivateRouteWithOrganization,
  RouteWithRedirect,
} from "components/AuthWrapper/AuthRouter";
import Logout from "components/Logout";
import compareVersions from "compare-versions";
import FillProcess from "components/FillProcess";
import ErrorBoundaryWrapper from "components/ErrorBoundary";
import Scanner from "components/Scanner";
import { WFPCoreProvider } from "@progressiveui/react";
import SelectOrganization from "components/SelectOrganization";
import CreateOrganization from "components/SelectOrganization/CreateOrganization";
import Account from "components/Account";
import NotificationsProvider, {
  NotificationsProviderWeb,
} from "helpers/notifications/PushContext";
import { Capacitor } from "@capacitor/core";
import Onboarding from "components/Onboarding";

import { Auth0Provider } from "@auth0/auth0-react";
import { updateInfo } from "ducks/update";
import ReviewInvite from "components/Invite";
import useAppIdentifier from "helpers/useAppIdentifier";
import RedirectSuccess from "components/Logout/RedirectSuccess";
import Admin from "components/Admin";
import OutdatedNotification from "components/OutdatedNotification";
import ThemeHandler from "components/ThemeHandler";

const history = createBrowserHistory();

function App() {
  const appIdentifier = useAppIdentifier();
  const [close, setClose] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  const NotificationsProviderSelector = isNative
    ? NotificationsProvider
    : NotificationsProviderWeb;

  const appInfo: { data: { supportedVersion: string } } =
    updateInfo.useGetUpdateInfoQuery(
      {},
      {
        pollingInterval: 1000000,
      },
    );

  if (
    appInfo?.data?.supportedVersion &&
    compareVersions(
      appInfo?.data?.supportedVersion,
      import.meta.env.REACT_APP_VERSION,
    ) === 1 &&
    close === false
  ) {
    return <OutdatedNotification appInfo={appInfo} setClose={setClose} />;
  }

  const onRedirectCallback = (appState) => {
    if (appState?.returnTo) {
      history.push(appState.returnTo);
    }
  };

  const ErrorBoundaryWrapperMatch =
    import.meta.env.MODE === "development" ? "div" : ErrorBoundaryWrapper;

  return (
    <div className="App">
      <WFPCoreProvider initialTheme="light" wrapperElement={document?.body}>
        <ThemeHandler />
        <ErrorBoundaryWrapperMatch>
          <Auth0Provider
            domain={import.meta.env.REACT_APP_AUTH0_DOMAIN}
            clientId={import.meta.env.REACT_APP_AUTH0_CLIENT_ID}
            cacheLocation="localstorage"
            useRefreshTokens={true}
            onRedirectCallback={onRedirectCallback}
            redirectUri={
              Capacitor.isNativePlatform()
                ? `${appIdentifier}://auth.wirewire.de/capacitor/${appIdentifier}/login`
                : window.location.origin + "/login"
            }
          >
            <NotificationsProviderSelector history={history}>
              <Router history={history}>
                <Switch>
                  <RouteWithRedirect path="/scanner" component={Scanner} />
                  <RouteWithRedirect path="/login" component={Login} />
                  <Route path="/logout" component={Logout} />
                  <Route path="/redirectsuccess" component={RedirectSuccess} />
                  <Route path="/payment" component={RedirectSuccess} />
                  <PrivateRouteWithOrganization
                    path="/account"
                    component={Account}
                  />
                  <PrivateRouteWithOrganization
                    path="/:organization/onboarding/:step?"
                    component={Onboarding}
                  />

                  <PrivateRouteWithOrganization
                    path="/:organization/invite/:token?"
                    component={ReviewInvite}
                  />
                  <PrivateRouteWithOrganization
                    path="/admin"
                    component={Admin}
                  />
                  <PrivateRouteWithOrganization
                    path="/createOrganization/:entry?/:detail?"
                    component={CreateOrganization}
                  />
                  <PrivateRouteWithOrganization
                    path="/onboarding/:step?"
                    component={Onboarding}
                  />
                  <PrivateRouteWithOrganization
                    path="/:organization/:patient?/:action?/:detail?"
                    component={Settings}
                  />

                  <PrivateRouteWithOrganization
                    path="/"
                    component={SelectOrganization}
                  />
                </Switch>
              </Router>
            </NotificationsProviderSelector>
          </Auth0Provider>
        </ErrorBoundaryWrapperMatch>
      </WFPCoreProvider>
    </div>
  );
}

export default App;
