import React from "react";
import { SidebarContentHeader } from "@progressiveui/react";
import SidebarBackButton from "components/SidebarBackButton";
import { Trans } from "react-i18next";
import styles from "./settingsMobileHeader.module.scss";
import { NavLink, useHistory, useLocation } from "react-router-dom";
import { useIsDesktop } from "@internetderdinge/web";
import { useSettingsContent } from "../SettingsContentContext";

export default function SettingsMobileHeader({ components }: any) {
  const {
    customMobileHeader,
    nameCapitalized,
    overviewUrl,
    name,
    sidebarBackButtonTitle,
    mobileSubmitButtonTitle,
    title,
    urlId,
  } = useSettingsContent();

  const history = useHistory();
  const location = useLocation();

  const isDesktop = useIsDesktop();
  if (isDesktop) return null;

  return (
    <>
      <SidebarContentHeader>
        {location.backOption === "detailPage" ? (
          <span
            //to={`${overviewUrl}`}
            onClick={() => history.goBack()}
            className={styles.backButton}
          >
            <SidebarBackButton
              title={
                sidebarBackButtonTitle
                  ? sidebarBackButtonTitle
                  : name
                    ? name + "-SINGULAR"
                    : "back"
              }
            />
          </span>
        ) : (
          <NavLink to={`${overviewUrl}`} className={styles.backButton}>
            <SidebarBackButton
              title={
                sidebarBackButtonTitle
                  ? sidebarBackButtonTitle
                  : name
                    ? name + "-SINGULAR"
                    : "back"
              }
            />
          </NavLink>
        )}
        <div className={styles.mobileName}>
          {customMobileHeader ? (
            customMobileHeader
          ) : title ? (
            title
          ) : (
            <Trans>{nameCapitalized}</Trans>
          )}
        </div>

        <components.SettingsSubmitButton
          title={
            mobileSubmitButtonTitle ? (
              mobileSubmitButtonTitle
            ) : urlId === "new" ? (
              <Trans>Create</Trans>
            ) : (
              <Trans>Save</Trans>
            )
          }
        />

        {/* customDelete ? (
          customDelete
        ) : urlId !== "new" && deleteEntry && !hideDelete ? (
          <DeleteModalSettings
            customButton={
              <Button
                data-testid="delete-button"
                kind="ghost"
                icon={<FontAwesomeIcon icon={faTrashAlt} />}
                className={styles.mobileRemove}
              />
            }
          />
        ) : null */}
      </SidebarContentHeader>
    </>
  );
}
