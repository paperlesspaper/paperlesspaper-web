import React from "react";
import styles from "./styles.module.scss";
import { Trans } from "react-i18next";
import { useActiveUserDevice } from "helpers/useUsers";
import { useIsDesktop } from "@internetderdinge/web";
import DeviceStatus from "components/SettingsDevices/DeviceStatus";
import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import { deviceKindHasFeature } from "helpers/devices/deviceList";

export default function SidebarContent() {
  const isDesktop = useIsDesktop();
  const activeUserDevice = useActiveUserDevice();

  const hasEpaperFeature = deviceKindHasFeature(
    "epaper",
    activeUserDevice.data?.kind,
  );

  return (
    <>
      <div className={styles.meta}></div>

      <div className={styles.meta}>
        {isDesktop && (
          <DeviceStatus className={styles.deviceStatus} show="errors" />
        )}
        <div className={styles.newButton}>
          {isDesktop && hasEpaperFeature && (
            <NewEntryButton
              icon={<AddIcon />}
              className={styles.fillButton}
              kind="primary"
              small={false}
              iconReverse={false}
            >
              <Trans>New picture</Trans>
            </NewEntryButton>
          )}
        </div>
      </div>
    </>
  );
}
