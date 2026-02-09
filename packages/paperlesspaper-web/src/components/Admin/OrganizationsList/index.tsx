import React from "react";
import useSettingsOverview from "helpers/useSettingsOverviewNew";
import SettingsSidebar from "components/Settings/SettingsWithSidebar";
import { Item } from "@progressiveui/react";
import SettingsNotificationDetail from "./OrganizationsListDetail";
import ButtonRouter from "components/ButtonRouter";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog } from "@fortawesome/pro-solid-svg-icons";
import { organizationsApi } from "ducks/organizationsApi";

const SettingsNotificationsItem = ({ e, ...other }: any) => {
  /*if (debug || e.lastRunAt)*/

  return (
    <Item
      title={
        e.name ? (
          e.name
        ) : (
          <>
            <Trans>Unnamed organization</Trans>
          </>
        )
      }
      className={styles.item}
      {...other}
      additional={e.kind}
      hint={<div className={styles.battery}></div>}
    >
      {e.usersData.length} Users, {e.devicesData.length} Devices
      {/*<NavLink to={`/${e.id}`}>Visit</NavLink>

      <h3>Users</h3>
      <ul>
        {e.usersData &&
          e.usersData.map((d) => (
            <li>
              {d.id} {d.owner}
            </li>
          ))}
      </ul>

      <h3>Devices</h3>
      <ul>
        {e.devicesData &&
          e.devicesData.map((d) => (
            <li>
              {d.id} {d.meta?.name}
            </li>
          ))}
      </ul>*/}
    </Item>
  );
};

export default function OrganizationsList() {
  const settingsOverview = useSettingsOverview({
    api: organizationsApi,
    allQuery: organizationsApi.useGetAllOrganizationsAdminQuery,
    queryOptionsFunction: ({ search }) => {
      console.log("searchsearchsearchsearch", search);
      return {
        sortBy: "lastRunAt:desc",
        search: search.search,
        //id: "6149aa23c217701082747241",
      };
    },
  });

  /*const [updateStatus] = messagesApi.useUpdateStatusMutation();

 const updateReadStatus = (entryData) => {
    if (entryData?.data.id && entryData.result?.status !== "read")
      updateStatus({ id: entryData.data.id, data: { status: "read" } });
  };*/

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
