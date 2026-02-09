import React from "react";
import { Trans } from "react-i18next";
import LutFields from "../../Fields/LutFields";
import CssEditor from "../../Fields/CssEditor";
import WebsiteName from "../../Fields/WebsiteName";
import RotateScreen from "../../Fields/RotateScreen";
import DeletePaper from "../ImageEditor/DeletePaper";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

const Elements = () => {
  return (
    <>
      <WebsiteName />
      <LutFields />
      <CssEditor />
      <RotateScreen />
      <DeletePaper />
    </>
  );
};

export default function WebsiteEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "website" } });
  return (
    <IntegrationModal
      store={store}
      modalHeading={<Trans>Display website</Trans>}
      elements={Elements}
      passiveModal
    />
  );
}
