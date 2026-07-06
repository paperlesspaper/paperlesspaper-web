import React from "react";
import { Button, Callout, InlineLoading, Modal } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import qs from "qs";

import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import OrganizationName from "components/OrganizationName";
import { devicesApi } from "ducks/devices";
import { organizationsApi } from "ducks/organizationsApi";
import { deviceKindHasFeature } from "helpers/devices/deviceList";
import { isIncompleteOnboardingOrganization } from "helpers/organizations/onboardingOrganization";
import styles from "components/ShareTarget/styles.module.scss";
import {
  fetchManifest,
  isTrustedIntegrationConfigUrl,
  validateIntegrationConfigUrl,
} from "components/Epaper/Integrations/OpenIntegrationEditor/manifest";
import type { OpenIntegrationManifest } from "components/Epaper/Integrations/OpenIntegrationEditor/types";
import { createIntegrationInstallSession } from "helpers/integrationInstallSession";

const getDeviceLabel = (device: any) =>
  device.meta?.name ||
  device.name ||
  device.info?.name ||
  device.deviceId ||
  device.id;

const getQueryValue = (value: any) => {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  return "";
};

export default function IntegrationInstallTarget() {
  const history = useHistory();
  const location = useLocation();
  const { pluginConfigUrl, url } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });
  const integrationUrl = getQueryValue(url) || getQueryValue(pluginConfigUrl);
  const validatedIntegrationUrl = React.useMemo(() => {
    if (!integrationUrl) return "";
    try {
      return validateIntegrationConfigUrl(integrationUrl);
    } catch {
      return "";
    }
  }, [integrationUrl]);
  const isTrustedIntegrationUrl =
    isTrustedIntegrationConfigUrl(validatedIntegrationUrl);
  const [manifest, setManifest] =
    React.useState<OpenIntegrationManifest | null>(null);
  const [manifestLoading, setManifestLoading] = React.useState(false);
  const [manifestError, setManifestError] = React.useState<string | null>(null);

  const organizations = organizationsApi.useGetAllOrganizationsQuery();
  const visibleOrganizations = (organizations.data || []).filter(
    (organization) => !isIncompleteOnboardingOrganization(organization),
  );
  const [selectedOrganization, setSelectedOrganization] =
    React.useState<string>("");
  const [selectedDevice, setSelectedDevice] = React.useState<string>("");

  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: selectedOrganization },
    { skip: !selectedOrganization },
  );

  const epaperDevices = React.useMemo(
    () =>
      (devices.data || []).filter((device) =>
        deviceKindHasFeature("epaper", device.kind),
      ),
    [devices.data],
  );

  React.useEffect(() => {
    setManifest(null);
    setManifestLoading(false);

    if (!integrationUrl) {
      setManifestError(null);
      return;
    }

    if (validatedIntegrationUrl) {
      setManifestError(null);
      return;
    }

    try {
      validateIntegrationConfigUrl(integrationUrl);
    } catch (error: any) {
      setManifestError(error?.message || "Invalid config URL");
    }
  }, [integrationUrl, validatedIntegrationUrl]);

  const loadManifest = React.useCallback(async () => {
    if (!validatedIntegrationUrl) return;

    const controller = new AbortController();

    setManifest(null);
    setManifestError(null);
    setManifestLoading(true);

    try {
      const nextManifest = await fetchManifest(
        validatedIntegrationUrl,
        controller.signal,
      );
      setManifest(nextManifest);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setManifestError(error?.message || "Failed to load manifest");
      }
    } finally {
      if (!controller.signal.aborted) {
        setManifestLoading(false);
      }
    }
  }, [validatedIntegrationUrl]);

  React.useEffect(() => {
    if (!validatedIntegrationUrl) return;
    if (!isTrustedIntegrationUrl) return;
    if (manifest || manifestLoading) return;
    if (manifestError) return;

    void loadManifest();
  }, [
    isTrustedIntegrationUrl,
    loadManifest,
    manifest,
    manifestError,
    manifestLoading,
    validatedIntegrationUrl,
  ]);

  React.useEffect(() => {
    if (!selectedOrganization) return;
    setSelectedDevice("");
  }, [selectedOrganization]);

  React.useEffect(() => {
    if (selectedDevice || epaperDevices.length !== 1) return;
    setSelectedDevice(epaperDevices[0].id);
  }, [epaperDevices, selectedDevice]);

  const close = () => {
    history.push("/");
  };

  const submit = () => {
    if (
      !manifest ||
      !validatedIntegrationUrl ||
      !selectedOrganization ||
      !selectedDevice
    )
      return;

    const integrationInstallId = createIntegrationInstallSession(
      validatedIntegrationUrl,
      manifest,
    );
    const query = qs.stringify({
      pluginConfigUrl: validatedIntegrationUrl,
      integrationInstallId,
    });

    history.push(
      `/${selectedOrganization}/calendar/device/${selectedDevice}/new/plugin?${query}`,
    );
  };

  return (
    <Modal
      open
      modalHeading={<Trans>Select target</Trans>}
      primaryButtonText={<Trans>Continue</Trans>}
      secondaryButtonText={<Trans>Cancel</Trans>}
      primaryButtonDisabled={
        !manifest || !selectedOrganization || !selectedDevice
      }
      kindMobile="fullscreen"
      onRequestClose={close}
      onSecondarySubmit={close}
      onRequestSubmit={submit}
      overscrollBehavior="inside"
    >
      {!integrationUrl ? (
        <p>
          <Trans>No integration URL found.</Trans>
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12, overflowWrap: "anywhere" }}>
            <strong>
              <Trans>Config URL</Trans>
            </strong>
            <br />
            {integrationUrl}
          </div>

          {manifestLoading && (
            <InlineLoading
              description={<Trans>Loading integration...</Trans>}
            />
          )}

          {manifestError && (
            <Callout
              kind="warning"
              title={<Trans>Integration not loaded</Trans>}
            >
              <Trans>{manifestError}</Trans>
            </Callout>
          )}

          {!isTrustedIntegrationUrl && !manifest && !manifestError && (
            <Callout kind="warning" title={<Trans>External integration</Trans>}>
              <Trans>
                This integration is hosted outside paperlesspaper.de. Load it
                only if you trust the source.
              </Trans>
            </Callout>
          )}

          {manifest && (
            <Callout
              kind="success"
              title={<Trans>Integration loaded successfully</Trans>}
            >
              <div>
                <strong>{manifest.name}</strong>
              </div>
              <div>
                <Trans>Version</Trans>: {manifest.version}
              </div>
            </Callout>
          )}

          {!manifestLoading &&
            !manifest &&
            (!isTrustedIntegrationUrl || manifestError) && (
              <Button
                onClick={loadManifest}
                disabled={!validatedIntegrationUrl}
              >
                <Trans>Load integration</Trans>
              </Button>
            )}
        </>
      )}

      {integrationUrl && organizations.isLoading ? (
        <InlineLoading description={<Trans>Loading organizations...</Trans>} />
      ) : integrationUrl ? (
        <>
          <MultiCheckboxWrapper
            kind="vertical"
            labelText={<Trans>Organization</Trans>}
          >
            {visibleOrganizations.map((organization) => (
              <MultiCheckbox
                key={organization.id}
                type="radio"
                name="integrationInstallOrganization"
                value={organization.id}
                checked={selectedOrganization === organization.id}
                onChange={() => setSelectedOrganization(organization.id)}
                labelText={<OrganizationName organization={organization} />}
                kind="vertical"
                fullWidth
              />
            ))}
          </MultiCheckboxWrapper>

          {selectedOrganization && devices.isLoading && (
            <div className={styles.deviceSelector}>
              <InlineLoading description={<Trans>Loading devices...</Trans>} />
            </div>
          )}

          {selectedOrganization && !devices.isLoading && (
            <>
              {epaperDevices.length === 0 ? (
                <p className={styles.deviceSelector}>
                  <Trans>No compatible device found.</Trans>
                </p>
              ) : (
                <MultiCheckboxWrapper
                  className={styles.deviceSelector}
                  kind="vertical"
                  labelText={<Trans>Select device</Trans>}
                >
                  {epaperDevices.map((device) => (
                    <MultiCheckbox
                      key={device.id}
                      type="radio"
                      name="integrationInstallDevice"
                      value={device.id}
                      checked={selectedDevice === device.id}
                      onChange={() => setSelectedDevice(device.id)}
                      labelText={getDeviceLabel(device)}
                      kind="vertical"
                      fullWidth
                    />
                  ))}
                </MultiCheckboxWrapper>
              )}
            </>
          )}
        </>
      ) : null}
    </Modal>
  );
}
