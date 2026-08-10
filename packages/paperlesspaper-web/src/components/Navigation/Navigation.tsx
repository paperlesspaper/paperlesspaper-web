import React, { useState } from "react";
import { flushSync } from "react-dom";
import { NavLink, useHistory, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./navigation.module.scss";
import { Trans, useTranslation } from "react-i18next";
import {
  faExchange,
  faMonitorHeartRate,
  faUser,
  faCog,
  faBookOpen,
  //faRectangleVertical,
  faImage,
} from "@fortawesome/pro-light-svg-icons";
import classNames from "classnames";

import {
  faCog as faCogActive,
  faMonitorHeartRate as faMonitorHeartRateActive,
  faUser as faUserActive,
  faBookOpen as faBookOpenActive,
  // faRectangleVertical as faRectangleVerticalActive,
  faImage as faImageActive,
  // faUsersMedical as faUsersMedicalActive,
} from "@fortawesome/pro-solid-svg-icons";
import { useActiveOrganzation } from "helpers/useOrganization";
import { useIsDesktop } from "@internetderdinge/web";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import Notification from "../Settings/Notification/Notification";
import useCalendarUrl from "helpers/urls/useCalendarUrl";
import useLatestOpenEntry from "helpers/useLatestOpenEntry";

export const useSidebarData = () => {
  const { organization } = useParams();

  const latestOpenEntry = useLatestOpenEntry();

  const isDesktop = useIsDesktop();
  const calendarUrl = useCalendarUrl();

  return {
    calendar: {
      name: "Current",
      to: /*`/${organization}/calendar`,*/ calendarUrl(latestOpenEntry),
      icon: faImage,
      iconActive: faImageActive,
    },
    library: {
      name: "Library",
      to: `/${organization}/library`,
      icon: faBookOpen,
      iconActive: faBookOpenActive,
      show: true,
    },
    users: {
      name: "Users",
      to:
        isDesktop && latestOpenEntry?.kind === "user"
          ? `/${organization}/users/${latestOpenEntry.entry}`
          : `/${organization}/users/`,
      icon: faUser,
      iconActive: faUserActive,
    },
    devices: {
      name: "Devices",
      to: `/${organization}/devices`,
      icon: faMonitorHeartRate,
      iconActive: faMonitorHeartRateActive,
      //desktopOnly: true,
    },
    settings: {
      name: "Settings",
      mobileName: "More",
      to: `/${organization}/advanced`,
      icon: faCog,
      iconActive: faCogActive,
      //mobileOnly: true,
      exact: true,
    },
  };
};

export default function SettingsList() {
  const { t } = useTranslation();
  const history = useHistory();

  const sidebar = useSidebarData();
  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const activeOrganization = useActiveOrganzation();

  /*const inBottomBar = Object.values(sidebar).filter((c) =>
    isDesktop || !c.desktopOnly ? true : false
  );*/

  const [keyboardShow, setKeyboardShow] = useState(false);
  const [touchActivePage, setTouchActivePage] = useState<string>();

  if (Capacitor.isNativePlatform()) {
    Keyboard.addListener("keyboardWillShow", () => {
      setKeyboardShow(true);
    });

    Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardShow(false);
    });
  }

  if (keyboardShow) return null;

  return (
    <nav
      aria-label={t("Primary navigation")}
      className={classNames(styles.navigation, {
        [styles.androidNative]: isAndroidNative,
      })}
    >
      <div className={styles.main}>
        {Object.entries(sidebar).map(([settingsPage, s]: any) => {
          const classes = classNames({
            [styles.desktopOnly]: s.desktopOnly,
            [styles.mobileOnly]: s.mobileOnly,
            [styles.touchActive]:
              !isAndroidNative && touchActivePage === settingsPage,
            /*[styles.active]:
              settingsPage === "settings" &&
              patient !== undefined &&
              !inBottomBar.find(([key, c]) => key === patient),*/
          });

          if (
            (s.professionalOnly === true &&
              activeOrganization?.kind !== "professional") ||
            s.show === false
          )
            return null;

          return (
            <NavLink
              key={settingsPage}
              to={s.to}
              id={`navigation${s.name}`}
              exact={s.exact}
              className={classes}
              activeClassName={touchActivePage ? "" : styles.active}
              onTouchStart={(e) => {
                e.preventDefault();

                if (!isAndroidNative) {
                  // Paint native-style touch feedback before the route changes.
                  flushSync(() => setTouchActivePage(settingsPage));
                }

                history.push(s.to);
              }}
              onTouchEnd={() => setTouchActivePage(undefined)}
              onTouchCancel={() => setTouchActivePage(undefined)}
            >
              <div className={styles.icon}>
                {settingsPage === "notifications" && <Notification />}
                <FontAwesomeIcon icon={s.icon} className={styles.iconRegular} />
                <FontAwesomeIcon
                  icon={s.iconActive}
                  className={styles.iconActive}
                />
              </div>
              <span className={s.mobileName ? styles.desktopLabel : undefined}>
                <Trans>{s.name}</Trans>
              </span>
              {s.mobileName && (
                <span className={styles.mobileLabel}>
                  <Trans>{s.mobileName}</Trans>
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
      <div className={styles.footer}>
        <NavLink to={`/?show=always`} exact>
          <div className={styles.icon}>
            <FontAwesomeIcon icon={faExchange} className={styles.iconRegular} />
          </div>
          <span>
            <Trans>Switch</Trans>
          </span>
        </NavLink>
      </div>
    </nav>
  );
}
