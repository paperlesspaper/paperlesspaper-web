import React from "react";
import { InlineLoading, Modal } from "@progressiveui/react";
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
import { getShareTargetPayload } from "helpers/shareTarget";
import styles from "./styles.module.scss";

const getDeviceLabel = (device: any) =>
  device.meta?.name ||
  device.name ||
  device.info?.name ||
  device.deviceId ||
  device.id;

export default function ShareTarget() {
  const history = useHistory();
  const location = useLocation();
  const { shareTargetId } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });
  const payload = getShareTargetPayload(shareTargetId);

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
    if (!payload || !selectedOrganization || !selectedDevice) return;

    const editorKind =
      payload.images.length > 1 ? "image-multi-upload" : "image";
    const query = qs.stringify({ shareTargetId: payload.id });

    history.push(
      `/${selectedOrganization}/calendar/device/${selectedDevice}/new/${editorKind}?${query}`,
    );
  };

  return (
    <Modal
      open
      modalHeading={<Trans>Select target</Trans>}
      primaryButtonText={<Trans>Continue</Trans>}
      secondaryButtonText={<Trans>Cancel</Trans>}
      primaryButtonDisabled={
        !payload || !selectedOrganization || !selectedDevice
      }
      kindMobile="fullscreen"
      onRequestClose={close}
      onSecondarySubmit={close}
      onRequestSubmit={submit}
    >
      {!payload ? (
        <p>
          <Trans>No shared images found.</Trans>
        </p>
      ) : organizations.isLoading ? (
        <InlineLoading description={<Trans>Loading organizations...</Trans>} />
      ) : (
        <>
          <MultiCheckboxWrapper
            kind="vertical"
            labelText={<Trans>Organization</Trans>}
          >
            {visibleOrganizations.map((organization) => (
              <MultiCheckbox
                key={organization.id}
                type="radio"
                name="shareTargetOrganization"
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
                      name="shareTargetDevice"
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
      )}
    </Modal>
  );
}
