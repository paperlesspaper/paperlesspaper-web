import React from "react";
import { Button, SidebarContentHeader } from "@progressiveui/react";
import SidebarBackButton from "components/SidebarBackButton";
import { Trans } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/pro-solid-svg-icons";
import styles from "./settingsMobileHeader.module.scss";
import { NavLink, useHistory, useLocation } from "react-router-dom";
import DeleteModal from "components/DeleteModal";
import { useIsDesktop } from "@internetderdinge/web";
import SettingsSubmitButton from "./SettingsSubmitButton";
import { useSettingsContent } from "../SettingsContentContext";
import DeleteModalSettings from "./DeleteModalSettings";

export default function SettingsMobileHeader({ components }: any) {
  const {
    customMobileHeader,
    customDelete,
    nameCapitalized,
    overviewUrl,
    deleteEntry,
    name,
    hideDelete,
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
