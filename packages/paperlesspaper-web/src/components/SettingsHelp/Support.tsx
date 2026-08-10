import { SettingsSidebarNoSidebar } from "components/Settings/SettingsWithSidebar";
import React from "react";
import { Story } from "@progressiveui/react";
import JsonViewer from "components/JsonViewer";
import { Trans } from "react-i18next";

export default function Support() {
  return (
    <SettingsSidebarNoSidebar
      title={<Trans>Help & Information</Trans>}
      hideHeaderRight
    >
      <Story>
        <h2>wirewire GmbH</h2>
        <p>
          <Trans>Version</Trans>: paperlesspaper{" "}
          {import.meta.env.REACT_APP_VERSION}
          <JsonViewer src={process.env} />
        </p>
      </Story>
    </SettingsSidebarNoSidebar>
  );
}
