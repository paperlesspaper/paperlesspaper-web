import React from "react";
import useSettingsOverview from "helpers/useSettingsOverviewNew";
import SettingsSidebar from "components/Settings/SettingsWithSidebar";
import { Item } from "@progressiveui/react";
import ButtonRouter from "components/ButtonRouter";
import { messagesApi } from "ducks/messagesApi";
import { Trans } from "react-i18next";
import { formatDistanceStrict, isValid } from "date-fns";
import { de } from "date-fns/locale";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog } from "@fortawesome/pro-solid-svg-icons";
import { iotDevicesApi } from "ducks/iotDevicesApi";
import IotDevicesDetails from "./IotDevicesDetails";

const IotDevicesItem = ({ e, ...other }: any) => {
  return (
    <Item
      title={<>{e.deviceId}</>}
      className={styles.item}
      {...other}
      additional={
        <div>
          {e.lastUpdateTime && isValid(new Date(e.lastUpdateTime)) && (
            <>
              {formatDistanceStrict(new Date(e.lastUpdateTime), new Date(), {
                addSuffix: true,
                locale: de,
              })}
            </>
          )}
        </div>
      }
      //subContent={<>Detail</>}
      unread={e.result?.status === "unread"}
      image={null}
    ></Item>
  );
  //return null;
};

export function ContentNewButton() {
  return null;
}

export function SidebarNewButton() {
  return null;
}

export default function IotDevicesList() {
  /* console.log("iotDevicesApi", iotDevicesApi);
  return null;
*/
  const settingsOverview = useSettingsOverview({
    api: iotDevicesApi,
    queryOptions: {
      sortBy: "lastRunAt:desc",
    },
  });

  const [updateStatus] = messagesApi.useUpdateStatusMutation();

  /* const updateReadStatus = (entryData) => {
     if (entryData?.data.id && entryData.result?.status !== "read")
      updateStatus({ id: entryData.data.id, data: { status: "read" } }); 
  }; */

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
      search={<></>}
      components={{ ContentNewButton, SidebarNewButton }}
      settingsOverview={settingsOverview}
      details={<IotDevicesDetails />}
      customMobileHeader={<>asddsa</>}
      customDetailLink={(e) => ({
        pathname: `/admin/iotdevices/${e.deviceId}/`,
        search: settingsOverview.search,
        backOption: "detailPage",
      })}
      item={IotDevicesItem}
    ></SettingsSidebar>
  );
}
