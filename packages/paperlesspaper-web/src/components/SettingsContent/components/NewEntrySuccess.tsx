import React from "react";
import { Trans } from "react-i18next";
import { useSettingsContent } from "../SettingsContentContext";

export const NewEntrySuccess =
  (/* { entryData, entryName, components }: any */) => {
    const { components, entryData, entryName } = useSettingsContent();
    return (
      <>
        <Trans>New entry</Trans>{" "}
        <b>
          <components.EntryName entry={entryData} entryName={entryName} />
        </b>{" "}
        <Trans>was successfully created.</Trans>
      </>
    );
  };
