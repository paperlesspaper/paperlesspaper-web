import React from "react";
import useSettingsOverview from "helpers/useSettingsOverviewNew";
import SettingsSidebar from "components/Settings/SettingsWithSidebar";
import { Item, Tag } from "@progressiveui/react";
import SettingsNotificationDetail from "./DevicesListDetail";
import ButtonRouter from "components/ButtonRouter";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faSlashForward } from "@fortawesome/pro-solid-svg-icons";
import { devicesApi } from "ducks/devices";
import UserName from "components/UserName";
import DeviceIdFormatted from "components/SettingsDevices/DeviceIdFormatted";
import Battery from "components/Battery";
import DeviceIcon from "components/DeviceIcon";
import { faDollarCircle, faSlash } from "@fortawesome/pro-solid-svg-icons";
import DeviceName from "components/DeviceName";

const SettingsNotificationsItem = ({ e, ...other }: any) => {
  /*if (debug || e.lastRunAt)*/

  return (
    <Item
      title={<DeviceName device={e} user={e.patientData} />}
      className={styles.item}
      {...other}
      additional={
        <>
          {e.deviceId?.startsWith("nrf-3513") ? (
            <Tag type="success">prod</Tag>
          ) : e.deviceId?.startsWith("nrf-") ? (
            <Tag>dev</Tag>
          ) : (
            ""
          )}

          <FontAwesomeIcon
            icon={e?.payment?.customer ? faDollarCircle : faSlashForward}
          />
        </>
      }
      hint={
        <div className={styles.battery}>{/* <Battery device={e} /> */}</div>
      }
      subContent={
        <DeviceIdFormatted kind={e.kind}>{e.deviceId}</DeviceIdFormatted>
      }
      image={<DeviceIcon device={e.kind} className={styles.deviceIcon} />}
    >
      {/* <UserName id={e.patient} /> */}
    </Item>
  );
};

export default function DevicesList() {
  const settingsOverview = useSettingsOverview({
    api: devicesApi,
    allQuery: devicesApi.useGetAllDevicesAdminQuery,
    queryOptionsFunction: ({ search }) => {
      return {
        sortBy: "createdAt:desc",
        search: search.search,
      };
    },
  });

  return (
    <SettingsSidebar
      customButtons={
        <ButtonRouter
          to={{
            pathname: `/account`,
            backOption: "detailPage",
          }}
          icon={<FontAwesomeIcon icon={faCog} />}
        >
          <Trans>Configure</Trans>
        </ButtonRouter>
      }
      customDetailLink={(e) => ({
        pathname: `/admin/${
          /* settingsOverview.duckName ||*/ settingsOverview.name
        }/${e.id}/`,
        search: settingsOverview.search,
        backOption: "detailPage",
      })}
      settingsOverview={settingsOverview}
      details={<SettingsNotificationDetail />}
      item={SettingsNotificationsItem}
    ></SettingsSidebar>
  );
}
