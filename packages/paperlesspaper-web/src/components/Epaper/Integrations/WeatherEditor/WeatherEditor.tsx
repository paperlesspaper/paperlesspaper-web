import React from "react";
import { Trans } from "react-i18next";
import CalendarEditorElements from "./WeatherEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function WeatherEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "weather" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Display Weather</Trans>}
      elements={CalendarEditorElements}
      store={store}
      passiveModal
    />
  );
}
