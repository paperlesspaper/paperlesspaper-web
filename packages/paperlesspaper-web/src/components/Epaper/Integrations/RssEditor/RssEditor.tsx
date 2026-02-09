import React from "react";
import { Trans } from "react-i18next";
import LutFields from "../../Fields/LutFields";
import CssEditor from "../../Fields/CssEditor";
import RotateScreen from "../../Fields/RotateScreen";
import DesignSettings from "./DesignSettings";
import RssFeedName from "../../Fields/RssFeedName";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import DeletePaper from "../ImageEditor/DeletePaper";

const Elements = () => {
  return (
    <>
      <RssFeedName />
      <DesignSettings />
      <RotateScreen />
      <CssEditor />
      <LutFields />
      <DeletePaper />
    </>
  );
};

export default function RssEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "rss" } });
  return (
    <IntegrationModal
      elements={Elements}
      modalHeading={<Trans>Display RSS-Feed</Trans>}
      passiveModal
      store={store}
    />
  );
}
