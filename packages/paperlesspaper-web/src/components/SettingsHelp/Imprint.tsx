import { SettingsSidebarNoSidebar } from "components/Settings/SettingsWithSidebar";
import React from "react";
import styles from "./styles.module.scss";
import { Trans, useTranslation } from "react-i18next";

const Content = ({ className }: any) => {
  const { t } = useTranslation();

  return (
    <div className={`${styles.iframeWrapper} ${className || ""}`}>
      <iframe
        title={t("Imprint")}
        src={`${
          import.meta.env.REACT_APP_SERVER_WEBSITE_URL
        }/posts/imprint/?app=true`}
        className={styles.iframe}
      />
    </div>
  );
};

export default function SettingsHelp() {
  return (
    <SettingsSidebarNoSidebar
      fullHeight
      fullWidth
      title={<Trans>Imprint</Trans>}
      hideTitle
      hideHeaderRight
      hideDelete
      hideSubmitButton
      components={{ Content }}
    ></SettingsSidebarNoSidebar>
  );
}
