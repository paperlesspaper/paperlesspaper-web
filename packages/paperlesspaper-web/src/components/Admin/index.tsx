import React from "react";
import DevicesList from "./DevicesList";
import { Route, Switch } from "react-router";
import { NavLink } from "react-router-dom";
import {
  Empty,
  MainNavigation,
  MainNavigationItem,
} from "@progressiveui/react";
import OrganizationsList from "./OrganizationsList";
import styles from "./styles.module.scss";
import Homepage from "./Homepage";
import IotDevicesList from "./IotDevicesList";
import { Trans } from "react-i18next";
import Avatar from "components/Avatar";
import useAccount from "helpers/useAccount";
import ButtonRouter from "components/ButtonRouter";

export default function Admin() {
  const account = useAccount();

  if (
    account.user["https://memo.wirewire.de/roles"] &&
    account.user["https://memo.wirewire.de/roles"].includes("admin")
  ) {
    return (
      <>
        <MainNavigation
          className={styles.mainNavigation}
          pageWidth="full"
          logo={<NavLink to="/admin">paperlesspaper</NavLink>}
        >
          <MainNavigationItem>
            <NavLink to="/admin">
              <Trans>Overview</Trans>
            </NavLink>
          </MainNavigationItem>
          <MainNavigationItem>
            <NavLink to="/admin/devices">
              <Trans>Devices</Trans>
            </NavLink>
          </MainNavigationItem>
          <MainNavigationItem>
            <NavLink to="/admin/iotdevices">IoT</NavLink>
          </MainNavigationItem>
          <MainNavigationItem>
            <NavLink to="/admin/organizations">
              <Trans>Organizations</Trans>
            </NavLink>
          </MainNavigationItem>
          <MainNavigationItem>
            <ButtonRouter to="/" kind="navigation">
              Homepage
            </ButtonRouter>
          </MainNavigationItem>
          <MainNavigationItem>
            <Avatar kind="medium" user={account?.user} />
          </MainNavigationItem>
        </MainNavigation>

        <Switch>
          <Route path="/admin/devices/:entry?" component={DevicesList} />
          <Route path="/admin/iotdevices/:entry?" component={IotDevicesList} />
          <Route
            path="/admin/organizations/:entry?"
            component={OrganizationsList}
          />
          <Route path="/admin/" component={Homepage} />
        </Switch>
      </>
    );
  }
  return <Empty>No admin user</Empty>;
}
