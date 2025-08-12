import React from "react";
import { Trans } from "react-i18next";
import DaysLeftEditorElements from "./DaysLeftEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function DaysLeftEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "days-left" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Days left</Trans>}
      elements={DaysLeftEditorElements}
      store={store}
      passiveModal
    />
  );
}
