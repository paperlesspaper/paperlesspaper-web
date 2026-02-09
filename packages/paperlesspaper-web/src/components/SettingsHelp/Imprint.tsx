import { SettingsSidebarNoSidebar } from "components/Settings/SettingsWithSidebar";
import React from "react";
import styles from "./styles.module.scss";
import { Trans } from "react-i18next";

const Content = ({ children, className, formClasses }: any) => {
  return (
    <div className={`${styles.iframeWrapper} ${className || ""}`}>
      <iframe
        title="Imprint"
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
