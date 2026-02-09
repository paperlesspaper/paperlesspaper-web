import React from "react";
import { Trans } from "react-i18next";
import GoogleCalendarEditorElements from "./GoogleCalendarEditorElements";
import { GoogleOAuthProvider } from "@react-oauth/google";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

import EmptyGoogleCalendar, {
  showEmptyGoogleCalendar,
} from "./EmptyGoogleCalendar";

export default function GoogleCalendarEditor() {
  const store = useIntegrationForm({
    defaultValues: { kind: "google-calendar" },
  });

  const components = {
    EmptyMessage: EmptyGoogleCalendar,
  };

  return (
    <GoogleOAuthProvider clientId="719541140462-7fg6e3rttotee9tsqmvqgr9mlp77tlq7.apps.googleusercontent.com">
      <IntegrationModal
        modalHeading={<Trans>Display calendar</Trans>}
        elements={GoogleCalendarEditorElements}
        store={store}
        passiveModal
        components={components}
        showEmpty={showEmptyGoogleCalendar}
      />
    </GoogleOAuthProvider>
  );
}
