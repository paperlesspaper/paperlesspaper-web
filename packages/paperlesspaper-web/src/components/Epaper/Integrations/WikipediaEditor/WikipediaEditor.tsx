import React from "react";
import { Trans } from "react-i18next";
import CalendarEditorElements from "./WikipediaEditorElements";
import useIntegrationForm from "../useIntegrationForm";
import IntegrationModal from "../IntegrationModal";

export default function WikipediaEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "wikipedia" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Wikipedia Article of the day</Trans>}
      store={store}
      elements={CalendarEditorElements}
      passiveModal
    />
  );
}
