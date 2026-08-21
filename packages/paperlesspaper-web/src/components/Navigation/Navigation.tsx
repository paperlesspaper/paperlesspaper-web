import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { NavLink, useLocation, useParams } from "react-router-dom";
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
  const location = useLocation();

  const sidebar = useSidebarData();
  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const activeOrganization = useActiveOrganzation();

  /*const inBottomBar = Object.values(sidebar).filter((c) =>
    isDesktop || !c.desktopOnly ? true : false
  );*/

  const [keyboardShow, setKeyboardShow] = useState(false);
  const [touchActivePage, setTouchActivePage] = useState<string>();
  const touchResetTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (touchResetTimeout.current !== undefined) {
      window.clearTimeout(touchResetTimeout.current);
      touchResetTimeout.current = undefined;
    }

    // Keep the touched tab selected until the new route has committed. This
    // prevents the indicator from briefly returning to the previous route.
    setTouchActivePage(undefined);

    return () => {
      if (touchResetTimeout.current !== undefined) {
        window.clearTimeout(touchResetTimeout.current);
      }
    };
  }, [location.pathname, location.search]);

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
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              onTouchStart={() => {
                if (!isAndroidNative) {
                  if (touchResetTimeout.current !== undefined) {
                    window.clearTimeout(touchResetTimeout.current);
                    touchResetTimeout.current = undefined;
                  }

                  // Paint native-style touch feedback without navigating yet.
                  flushSync(() => setTouchActivePage(settingsPage));
                }
              }}
              onTouchEnd={() => {
                if (!isAndroidNative) {
                  // Route changes clear the touch state above. The timeout is
                  // only a fallback when a touch does not result in a click.
                  touchResetTimeout.current = window.setTimeout(() => {
                    setTouchActivePage(undefined);
                    touchResetTimeout.current = undefined;
                  }, 500);
                }
              }}
              onTouchCancel={() => {
                if (touchResetTimeout.current !== undefined) {
                  window.clearTimeout(touchResetTimeout.current);
                  touchResetTimeout.current = undefined;
                }
                setTouchActivePage(undefined);
              }}
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
        <NavLink
          to={`/?show=always`}
          exact
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
        >
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
