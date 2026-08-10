import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import PrinterSetupInstructions from "./PrinterSetupInstructions";

export default function PrinterDesign() {
  return (
    <EditorButton
      id="settings"
      kind="secondary"
      text={<Trans>Instructions</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={PrinterSetupInstructions}
      modalHeading={<Trans>Printer instructions</Trans>}
    />
  );
}
