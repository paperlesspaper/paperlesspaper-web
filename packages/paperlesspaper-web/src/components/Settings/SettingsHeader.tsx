import React from "react";
import styles from "./settingsSidebar.module.scss";
import { SidebarHeader, InlineLoading } from "@progressiveui/react";
import { Trans } from "react-i18next";

import { SidebarBackButtonWithLink } from "components/SidebarBackButton";

export function SettingsHeader({
  search,
  components,
  customButtons,
  organizationId,
  backLink,
  duckName,
  name,
  namePluralUpperLetter,
  allQuery,
  ...props
}: any) {
  const CustomHeadingType = backLink ? "h5" : "h3";

  return (
    <SidebarHeader noPadding>
      <div className={styles.actions}>
        <CustomHeadingType>
          {components.BackLink ? (
            <components.BackLink
              SidebarBackButtonWithLink={SidebarBackButtonWithLink}
              backLink={backLink}
            />
          ) : (
            backLink && <SidebarBackButtonWithLink to={backLink} />
          )}
          <Trans>{namePluralUpperLetter || name}</Trans>
          {allQuery?.isLoading && <InlineLoading />}
        </CustomHeadingType>

        <components.SidebarHeaderButton
          customButtons={customButtons}
          organizationId={organizationId}
          duckName={duckName}
          name={name}
          {...props}
        />
      </div>
      <components.SidebarSearch className={styles.search} search={search} />
    </SidebarHeader>
  );
}
