import React from "react";

import { Callout, InlineLoading, Modal } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import QueryString from "qs";

import integrations from "../Integrations/applications";
import styles from "./styles.module.scss";
import NewIntegrationItem from "./NewIntegrationItem";
import { devicesApi } from "ducks/devices";
import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import { deviceByKind } from "helpers/devices/deviceList";

export default function SelectApplicationModal({
  overviewUrl,
}: {
  overviewUrl: string;
}) {
  const history = useHistory();
  const { organization } = useParams<{ organization: string }>();
  const [pendingAppId, setPendingAppId] = React.useState<string | null>(null);
  const [selectedFrameKind, setSelectedFrameKind] = React.useState<string>("");

  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization },
  );

  const availableFrameKinds = React.useMemo(() => {
    const kinds = new Set<string>();
    for (const device of devices.data || []) {
      if (!device?.kind) continue;
      kinds.add(device.kind);
    }
    return Array.from(kinds);
  }, [devices.data]);

  const supportsMultipleKinds = availableFrameKinds.length > 1;

  const goToEditor = (appId: string, frameKind?: string) => {
    const search = frameKind
      ? QueryString.stringify({ frameKind }, { addQueryPrefix: true })
      : "";

    history.push(`${overviewUrl}/new/${appId}${search}`);
  };

  const onSelectApp = (appId: string) => {
    if (devices.isLoading) return;

    if (!supportsMultipleKinds) {
      goToEditor(appId, availableFrameKinds[0]);
      return;
    }

    setPendingAppId(appId);
    setSelectedFrameKind(availableFrameKinds[0] || "");
  };

  const highlightedIntegrations = integrations.filter((app) =>
    app.tags?.includes("highlight"),
  );
  const regularIntegrations = integrations.filter(
    (app) => !app.tags?.includes("highlight"),
  );

  const renderIntegrationOption = (app, kind?: "highlight") => (
    <NewIntegrationItem
      key={app.id}
      app={app}
      //selected={kindSelect === app.id}
      href={`${overviewUrl}/new/${app.id}`}
      kind={kind}
      onSelect={() => onSelectApp(app.id)}
    />
  );

  return (
    <>
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
        {devices.isLoading ? (
          <InlineLoading />
        ) : (
          <div className={styles.integrationWrapper}>
            {highlightedIntegrations.length > 0 && (
              <div className={styles.integrationHighlight}>
                {highlightedIntegrations.map((app) =>
                  renderIntegrationOption(app, "highlight"),
                )}
              </div>
            )}
            {regularIntegrations.length > 0 && (
              <div className={styles.integrationContent}>
                {regularIntegrations.map(renderIntegrationOption)}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(pendingAppId && supportsMultipleKinds)}
        className={styles.modal}
        modalHeading={<Trans>Select frame kind</Trans>}
        primaryButtonText={<Trans>Continue</Trans>}
        secondaryButtonText={<Trans>Back</Trans>}
        kindMobile="fullscreen"
        primaryButtonDisabled={!pendingAppId || !selectedFrameKind}
        onRequestSubmit={() => {
          if (!pendingAppId || !selectedFrameKind) return;
          goToEditor(pendingAppId, selectedFrameKind);
        }}
        onRequestClose={() => setPendingAppId(null)}
      >
        <Callout kind="warning" title={<Trans>Beta</Trans>}>
          <Trans>This is currently a test feature.</Trans>
        </Callout>
        <br />
        <br />
        <MultiCheckboxWrapper
          kind="vertical"
          labelText={<Trans>Frame kind</Trans>}
          helperText={
            <Trans>
              Choose the target frame kind for this integration. The editor
              preview will use this size.
            </Trans>
          }
        >
          {availableFrameKinds.map((kind) => {
            const deviceMeta = deviceByKind(kind);
            const label = deviceMeta?.name || kind;
            const resolution = deviceMeta?.resolution
              ? `${deviceMeta.resolution.width} x ${deviceMeta.resolution.height}`
              : undefined;

            return (
              <MultiCheckbox
                key={kind}
                type="radio"
                name="frameKindSelection"
                value={kind}
                checked={selectedFrameKind === kind}
                onChange={() => setSelectedFrameKind(kind)}
                labelText={label}
                description={resolution}
                kind="vertical"
                fullWidth
              />
            );
          })}
        </MultiCheckboxWrapper>
      </Modal>
    </>
  );
}
