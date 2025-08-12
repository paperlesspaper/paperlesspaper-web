import React from "react";
import { Trans } from "react-i18next";
import CalendarEditorElements from "./CalendarEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function CalendarEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "calendar" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Display calendar</Trans>}
      elements={CalendarEditorElements}
      store={store}
      passiveModal
    />
  );
}
