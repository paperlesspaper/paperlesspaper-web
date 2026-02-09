import React from "react";
import styles from "./styles.module.scss";
import { Trans } from "react-i18next";
import { useActiveUser, useActiveUserDevice } from "helpers/useUsers";
import { Button } from "@progressiveui/react";
import { useIsDesktop } from "@internetderdinge/web";
import DeviceStatus from "components/SettingsDevices/DeviceStatus";
import FillStartButton from "components/FillProcess/FillStart";
import Status from "components/Status";
import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import qs from "qs";
import { useParams } from "react-router-dom";
import { deviceKindHasFeature } from "helpers/devices/deviceList";
import ButtonRouter from "components/ButtonRouter";

export default function SidebarContent() {
  const isDesktop = useIsDesktop();
  const currentPatient = useActiveUser();
  const activeUserDevice = useActiveUserDevice();
  const params = useParams();

  const [currentPrint, setCurrentPrint] = React.useState<any>(null);

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
