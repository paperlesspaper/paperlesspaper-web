import React from "react";
import { devicesApi } from "ducks/devices";
import useSettingsOverview from "helpers/useSettingsOverviewNew";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";
import SettingsSidebar from "components/Settings/SettingsWithSidebar";
import { Item } from "@progressiveui/react";
import SettingsDevicesDetail from "./SettingsDevicesDetail";
import DeviceIcon from "components/DeviceIcon";
import Battery from "components/Battery";
import UserName from "components/UserName";
import DeviceIdFormatted from "./DeviceIdFormatted";
import { useParams } from "react-router-dom";
import SettingsDevicesNew from "./SettingsDevicesNew";
import useQs from "helpers/useQs";
import DeviceName from "components/DeviceName";
import { deviceKindHasFeature } from "helpers/devices/deviceList";
import { deviceByKind } from "@paperlesspaper/helpers";
export default function SettingsDevices() {
  const settingsOverview = useSettingsOverview({
    name: "devices",
    api: devicesApi,
  });
  const { entry } = useParams();
  const { analog } = useQs();

  return (
    <SettingsSidebar
      settingsOverview={settingsOverview}
      details={
        entry === "new" && !analog ? (
          <SettingsDevicesNew />
        ) : (
          <SettingsDevicesDetail />
        )
      }
      item={({ e, ...other }) => {
        const deviceMeta = deviceByKind(e.kind);
        return (
          <Item
            title={<DeviceName device={e} />}
            hint={<Battery device={e} className={styles.battery} />}
            {...other}
            subContent={
              <DeviceIdFormatted kind={e.kind}>{e.deviceId}</DeviceIdFormatted>
            }
            image={<DeviceIcon device={e.kind} className={styles.deviceIcon} />}
          >
            {!deviceKindHasFeature("nouser", e.kind) ? (
              <UserName id={e.patient} />
            ) : (
              <>
                {deviceMeta.name} <Trans>picture frame</Trans>
              </>
            )}
          </Item>
        );
      }}
    ></SettingsSidebar>
  );
}
