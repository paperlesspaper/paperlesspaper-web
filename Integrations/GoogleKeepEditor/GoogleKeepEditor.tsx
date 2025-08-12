import React from "react";
import { Trans } from "react-i18next";
import GoogleKeepEditorElements from "./GoogleKeepEditorElements";
import { GoogleOAuthProvider } from "@react-oauth/google";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";

import EmptyGoogleCalendar, {
  showEmptyGoogleCalendar,
} from "../GoogleCalendarEditor/EmptyGoogleCalendar";

export default function GoogleKeepEditor() {
  const store = useIntegrationForm({
    defaultValues: { kind: "google-keep" },
  });

  const components = {
    EmptyMessage: EmptyGoogleCalendar,
  };

  return (
    <GoogleOAuthProvider clientId="719541140462-7fg6e3rttotee9tsqmvqgr9mlp77tlq7.apps.googleusercontent.com">
      <IntegrationModal
        modalHeading={<Trans>Display calendar</Trans>}
        elements={GoogleKeepEditorElements}
        store={store}
        passiveModal
        components={components}
        showEmpty={showEmptyGoogleCalendar}
      />
    </GoogleOAuthProvider>
  );
}
