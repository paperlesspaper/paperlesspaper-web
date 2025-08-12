import React from "react";
import { Trans } from "react-i18next";
import LutFields from "../../Fields/LutFields";
import CssEditor from "../../Fields/CssEditor";
import RotateScreen from "../../Fields/RotateScreen";
import DesignSettings from "./DesignSettings";
import RssFeedName from "../../Fields/RssFeedName";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

const Elements = () => {
  return (
    <>
      <RssFeedName />
      <DesignSettings />
      <RotateScreen />
      <CssEditor />
      <LutFields />
    </>
  );
};

export default function RssEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "rss" } });

  return (
    <IntegrationModal
      elements={Elements}
      store={store}
      modalHeading={<Trans>Display RSS-Feed</Trans>}
      passiveModal
    />
  );
}
