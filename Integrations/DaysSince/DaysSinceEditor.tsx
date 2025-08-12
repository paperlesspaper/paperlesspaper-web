import React from "react";
import { Trans } from "react-i18next";
import DaysSinceEditorElements from "./DaysSinceEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function DaysSinceEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "days-since" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Days left</Trans>}
      elements={DaysSinceEditorElements}
      store={store}
      passiveModal
    />
  );
}
