import React from "react";

import { Callout, InlineLoading, Modal, Search } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import QueryString from "qs";

import integrations, {
  applicationsOnlyIcons,
} from "../Integrations/applications";
import styles from "./styles.module.scss";
import NewIntegrationItem from "./NewIntegrationItem";
import { devicesApi } from "ducks/devices";
import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import { deviceByKind } from "helpers/devices/deviceList";
import { createIntegrationInstallSession } from "helpers/integrationInstallSession";
import { usePublicIntegrations } from "helpers/publicIntegrations";

type SelectableIntegrationApp = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags?: string[];
  status?: string;
  translate?: boolean;
  editorKind?: string;
  pluginConfigUrl?: string;
  searchText?: string;
  internal?: boolean;
};

const normalizeSearch = (value?: string) => value?.toLowerCase().trim() || "";

const matchesIntegrationSearch = (
  app: SelectableIntegrationApp,
  search: string,
) => {
  const query = normalizeSearch(search);
  if (!query) return true;

  return [
    app.name,
    app.description,
    app.id,
    app.pluginConfigUrl,
    app.searchText,
    ...(app.tags || []),
  ]
    .filter(Boolean)
    .some((value) => normalizeSearch(value).includes(query));
};

export default function SelectApplicationModal({
  overviewUrl,
}: {
  overviewUrl: string;
}) {
  const history = useHistory();
  const { organization } = useParams<{ organization: string }>();
  const { i18n, t } = useTranslation();
  const [pendingApp, setPendingApp] =
    React.useState<SelectableIntegrationApp | null>(null);
  const [selectedFrameKind, setSelectedFrameKind] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const publicIntegrations = usePublicIntegrations(i18n.language);

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

  const publicIntegrationApps = React.useMemo<SelectableIntegrationApp[]>(
    () =>
      publicIntegrations.data.map((integration) => ({
        id: `public-integration-${integration.id}`,
        name: integration.title,
        description: integration.description,
        icon: integration.iconUrl || applicationsOnlyIcons.plugin.icon,
        translate: false,
        editorKind: "plugin",
        pluginConfigUrl: integration.configUrl,
        status: integration.status,
        searchText: [
          integration.longTitle,
          integration.subtitle,
          integration.excerpt,
          integration.configName,
          integration.configDescription,
          integration.websiteUrl,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [publicIntegrations.data],
  );

  const getEditorKind = (app: SelectableIntegrationApp) =>
    app.editorKind || app.id;

  const getEditorSearch = (
    app: SelectableIntegrationApp,
    frameKind?: string,
    integrationInstallId?: string,
  ) => {
    const query = {
      ...(frameKind ? { frameKind } : {}),
      ...(app.pluginConfigUrl ? { pluginConfigUrl: app.pluginConfigUrl } : {}),
      ...(integrationInstallId ? { integrationInstallId } : {}),
    };

    return QueryString.stringify(query, { addQueryPrefix: true });
  };

  const getEditorHref = (app: SelectableIntegrationApp, frameKind?: string) =>
    `${overviewUrl}/new/${getEditorKind(app)}${getEditorSearch(
      app,
      frameKind,
    )}`;

  const goToEditor = (app: SelectableIntegrationApp, frameKind?: string) => {
    const integrationInstallId = app.pluginConfigUrl
      ? createIntegrationInstallSession(app.pluginConfigUrl)
      : undefined;

    history.push(
      `${overviewUrl}/new/${getEditorKind(app)}${getEditorSearch(
        app,
        frameKind,
        integrationInstallId,
      )}`,
    );
  };

  const onSelectApp = (app: SelectableIntegrationApp) => {
    if (devices.isLoading) return;

    if (!supportsMultipleKinds) {
      goToEditor(app, availableFrameKinds[0]);
      return;
    }

    setPendingApp(app);
    setSelectedFrameKind(availableFrameKinds[0] || "");
  };

  const highlightedIntegrations = React.useMemo(
    () =>
      integrations
        .filter((app) => app.internal !== true)
        .filter((app) => app.tags?.includes("highlight"))
        .filter((app) => matchesIntegrationSearch(app, search)),
    [search],
  );
  const regularIntegrations = React.useMemo<SelectableIntegrationApp[]>(
    () =>
      [
        ...integrations.filter(
          (app) => app.internal !== true && !app.tags?.includes("highlight"),
        ),
        ...publicIntegrationApps,
      ].filter((app) => matchesIntegrationSearch(app, search)),
    [publicIntegrationApps, search],
  );
  const hasVisibleIntegrations =
    highlightedIntegrations.length > 0 || regularIntegrations.length > 0;

  const renderIntegrationOption = (
    app: SelectableIntegrationApp,
    kind?: "highlight",
  ) => (
    <NewIntegrationItem
      key={app.id}
      app={app}
      //selected={kindSelect === app.id}
      href={getEditorHref(app)}
      kind={kind}
      onSelect={() => onSelectApp(app)}
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
            <div className={styles.integrationSearch}>
              <Search
                value={search}
                placeholder={t("Search...")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {highlightedIntegrations.length > 0 && (
              <div className={styles.integrationHighlight}>
                {highlightedIntegrations.map((app) =>
                  renderIntegrationOption(app, "highlight"),
                )}
              </div>
            )}
            {regularIntegrations.length > 0 && (
              <div className={styles.integrationContent}>
                {regularIntegrations.map((app) => renderIntegrationOption(app))}
              </div>
            )}
            {publicIntegrations.isLoading && (
              <InlineLoading
                description={<Trans>Loading integrations...</Trans>}
              />
            )}
            {!hasVisibleIntegrations && !publicIntegrations.isLoading && (
              <p className={styles.integrationEmpty}>
                <Trans>No integrations found.</Trans>
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(pendingApp && supportsMultipleKinds)}
        className={styles.modal}
        modalHeading={<Trans>Select frame kind</Trans>}
        primaryButtonText={<Trans>Continue</Trans>}
        secondaryButtonText={<Trans>Back</Trans>}
        overscrollBehavior="inside"
        kindMobile="fullscreen"
        primaryButtonDisabled={!pendingApp || !selectedFrameKind}
        onRequestSubmit={() => {
          if (!pendingApp || !selectedFrameKind) return;
          goToEditor(pendingApp, selectedFrameKind);
        }}
        onRequestClose={() => setPendingApp(null)}
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
