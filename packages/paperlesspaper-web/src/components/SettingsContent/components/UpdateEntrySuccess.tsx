import React from "react";
import { Trans } from "react-i18next";
import { useSettingsContent } from "../SettingsContentContext";

export const UpdateEntrySuccess =
  (/* { entryData, entryName, components }: any */) => {
    const { components, entryData, entryName } = useSettingsContent();
    return (
      <>
        <b>
          <components.EntryName entry={entryData} entryName={entryName} />
        </b>{" "}
        <Trans>was successfully saved.</Trans>
      </>
    );
  };
