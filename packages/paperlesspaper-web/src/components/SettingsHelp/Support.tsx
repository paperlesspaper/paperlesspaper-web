import { SettingsSidebarNoSidebar } from "components/Settings/SettingsWithSidebar";
import React from "react";
import { Story } from "@progressiveui/react";
import JsonViewer from "components/JsonViewer";

export default function Support() {
  return (
    <SettingsSidebarNoSidebar title="Help & Informations" hideHeaderRight>
      <Story>
        <h2>wirewire GmbH</h2>
        <p>
          Version: {import.meta.env.REACT_APP_NAME}{" "}
          {import.meta.env.REACT_APP_VERSION}
          <JsonViewer src={process.env} />
        </p>
      </Story>
    </SettingsSidebarNoSidebar>
  );
}
