import React from "react";
import { Trans } from "react-i18next";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import PrinterEditorElements from "./PrinterEditorElements";
import PrinterSetupContent from "./PrinterSetupContent";

export default function PrinterEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "printer" } });

  return (
    <IntegrationModal
      store={store}
      modalHeading={<Trans>Printer</Trans>}
      elements={PrinterEditorElements}
      passiveModal
      showEmpty
    >
      <PrinterSetupContent />
    </IntegrationModal>
  );
}
