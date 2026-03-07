import React from "react";
import useSettingsOverview from "helpers/useSettingsOverviewNew";
import SettingsSidebar from "components/Settings/SettingsWithSidebar";
import { Item } from "@progressiveui/react";
import { adminSearchApi } from "ducks/adminSearchApi";
import SearchListDetail from "./SearchListDetail";
import styles from "./styles.module.scss";

const SearchItem = ({ e, ...other }: any) => {
  return (
    <Item
      title={e.title}
      className={styles.item}
      additional={e.additional}
      subContent={e.subtitle}
      {...other}
    />
  );
};

export function ContentNewButton() {
  return null;
}

export function SidebarNewButton() {
  return null;
}

export default function SearchList() {
  const settingsOverview = useSettingsOverview({
    api: adminSearchApi,
    allQuery: adminSearchApi.useGetAllAdminSearchQuery,
    queryOptionsFunction: ({ search }) => ({
      search: search.search,
      limit: 20,
    }),
  });

  return (
    <SettingsSidebar
      components={{ ContentNewButton, SidebarNewButton }}
      settingsOverview={settingsOverview}
      details={<SearchListDetail settingsOverview={settingsOverview} />}
      item={SearchItem}
      customDetailLink={(entry) => ({
        pathname: `/admin/search/${entry.id}/`,
        search: settingsOverview.search,
        backOption: "detailPage",
      })}
    />
  );
}
