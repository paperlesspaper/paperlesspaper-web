import React from "react";
import { Trans } from "react-i18next";
import SunEditorElements from "./SunEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function SunEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "sunrise" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Sunrise & Sunset</Trans>}
      elements={SunEditorElements}
      store={store}
      passiveModal
    />
  );
}
