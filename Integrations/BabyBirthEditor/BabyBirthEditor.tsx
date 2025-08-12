import React from "react";
import { Trans } from "react-i18next";
import BabyBirthEditorElements from "./BabyBirthEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function BabyBirthEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "baby" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Display calendar</Trans>}
      elements={BabyBirthEditorElements}
      store={store}
      passiveModal
    />
  );
}
