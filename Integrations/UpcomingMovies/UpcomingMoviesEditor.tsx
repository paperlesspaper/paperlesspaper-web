import React from "react";
import { Trans } from "react-i18next";
import UpcomingMoviesEditorElements from "./UpcomingMoviesEditorElements";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

export default function UpcomingMoviesEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "movies" } });

  return (
    <IntegrationModal
      modalHeading={<Trans>Upcoming Movies</Trans>}
      elements={UpcomingMoviesEditorElements}
      store={store}
      passiveModal
    />
  );
}
