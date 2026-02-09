import React from "react";

import { Modal } from "@progressiveui/react";
import { Trans } from "react-i18next";

import integrations from "../Integrations/applications";
import styles from "./styles.module.scss";
import NewIntegrationItem from "./NewIntegrationItem";
import { useHistory } from "react-router-dom";

export default function SelectApplicationModal({
  overviewUrl,
}: {
  overviewUrl: string;
}) {
  const history = useHistory();

  const highlightedIntegrations = integrations.filter((app) =>
    app.tags?.includes("highlight")
  );
  const regularIntegrations = integrations.filter(
    (app) => !app.tags?.includes("highlight")
  );

  const renderIntegrationOption = (app, kind?: "highlight") => (
    <NewIntegrationItem
      key={app.id}
      app={app}
      //selected={kindSelect === app.id}
      href={`${overviewUrl}/new/${app.id}`}
      kind={kind}
    />
  );

  return (
    <Modal
      open
      className={styles.modal}
      modalHeading={<Trans>Select application</Trans>}
      primaryButtonText={<Trans>Continue</Trans>}
      passiveModal
      overscrollBehavior="inside"
      kindMobile="fullscreen"
      onRequestClose={() => history.push(`${overviewUrl}`)}
    >
      <div className={styles.integrationWrapper}>
        {highlightedIntegrations.length > 0 && (
          <div className={styles.integrationHighlight}>
            {highlightedIntegrations.map((app) =>
              renderIntegrationOption(app, "highlight")
            )}
          </div>
        )}
        {regularIntegrations.length > 0 && (
          <div className={styles.integrationContent}>
            {regularIntegrations.map(renderIntegrationOption)}
          </div>
        )}
      </div>
    </Modal>
  );
}
