import React from "react";
import { UserNameNew } from "components/UserName";
import Avatar from "components/Avatar";
import useSettingsOverview from "helpers/useSettingsOverviewNew";
import { Trans } from "react-i18next";
import SettingsSidebar from "components/Settings/SettingsWithSidebar";
import { Item, Tag } from "@progressiveui/react";
import SettingsUsersDetail from "./SettingsUsersDetail";
import styles from "./styles.module.scss";

import useCurrentUser from "helpers/useCurrentUser";
import UserMeta from "components/UserMeta";
import { usersApi } from "ducks/usersApi";

export default function SettingsUser() {
  const settingsOverview = useSettingsOverview({
    name: "users",
    api: usersApi,
  });

  const currentUser = useCurrentUser();

  return (
    <SettingsSidebar
      settingsOverview={settingsOverview}
      contentNewText={<Trans>Invite</Trans>}
      details={<SettingsUsersDetail />}
      sortData={(data) => {
        return [
          ...data.filter(({ id }) => id === currentUser?.data?.id),
          ...data.filter(({ id }) => id !== currentUser?.data?.id),
        ];
      }}
      item={({ e, ...other }) => (
        <Item
          {...other}
          hint={
            currentUser?.data?.id === e?.id ? (
              <Tag type="warning" className={styles.thisYou}>
                <Trans>This is you</Trans>
              </Tag>
            ) : e.status === "invited" ? (
              <Tag type="warning" className={styles.pending}>
                <Trans>Pending Invitation</Trans>
              </Tag>
            ) : null
          }
          title={<UserNameNew user={e} />}
          subContent={<>{e.meta?.phone}</>}
          image={<Avatar kind="medium" user={e} className={styles.avatar} />}
        >
          {e?.role === "onlyself" && (
            <Tag type="warning">
              <Trans>Limited Access</Trans>
            </Tag>
          )}
          <UserMeta user={e} />
        </Item>
      )}
    ></SettingsSidebar>
  );
}
