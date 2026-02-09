import React from "react";
import { Trans } from "react-i18next";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import ApothekenNotdienstElements from "./ApothekenNotdienstElements";

const DEFAULT_COORDINATES = {
  lat: 52.4974,
  lon: 13.4596,
};
const DEFAULT_REFRESH_INTERVAL_MINUTES = 30;

export default function ApothekenNotdienstEditor() {
  const store = useIntegrationForm({
    defaultValues: {
      kind: "apothekennotdienst",
      meta: {
        lat: DEFAULT_COORDINATES.lat,
        lon: DEFAULT_COORDINATES.lon,
        radius: 5,
        limit: 5,
        day: "today",
        refreshInterval: DEFAULT_REFRESH_INTERVAL_MINUTES * 60 * 1000,
        color: "dark",
        kind: "primary",
        language: "de-DE",
      },
    },
  });

  return (
    <IntegrationModal
      modalHeading={<Trans>Apotheken-Notdienst</Trans>}
      elements={ApothekenNotdienstElements}
      store={store}
      passiveModal
    />
  );
}
