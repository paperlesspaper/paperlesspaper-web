import { InlineLoading, Modal } from "@progressiveui/react";
import DeviceIcon from "components/DeviceIcon";
import DeviceName from "components/DeviceName";
import styles from "./integrationSend.module.scss";
import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import React from "react";
import { Trans } from "react-i18next";
import useEditor from "../ImageEditor/useEditor";
import { useParams } from "react-router-dom";
import { devicesApi } from "ducks/devices";
import { papersApi } from "ducks/ePaper/papersApi";

export default function IntegrationSend({
  onRequestSubmit,
}: {
  onRequestSubmit: () => void;
}) {
  const {
    setFrameSelectionOpen,
    isFrameSelectionOpen,
    selectedFrameId,
    setSelectedFrameId,
    isLoading,
    confirmFrameSelection,
    slideshowTargetPaperId,
    setSlideshowTargetPaperId,
    slideshowTargetPaperQuery,
    form,
  } = useEditor();

  const { organization } = useParams();
  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization }
  );

  const selectedDevice = devices.data?.find(
    (d: any) => d?.id === selectedFrameId
  );
  const selectedDevicePaperId = selectedDevice?.paper;

  const selectedDevicePaperQuery = papersApi.useGetSinglePapersQuery(
    selectedDevicePaperId,
    { skip: !selectedDevicePaperId }
  );

  const selectedFrameShowsSlideshow =
    selectedDevicePaperQuery.data?.kind === "slides";

  const currentPaperKind = form?.watch?.("kind");
  const isEditingSlidesIntegration = currentPaperKind === "slides";

  React.useEffect(() => {
    if (isEditingSlidesIntegration) {
      setSlideshowTargetPaperId?.(null);
    }
  }, [isEditingSlidesIntegration]);

  React.useEffect(() => {
    // Reset slideshow mode when switching frames or when the selected frame isn't a slideshow.
    if (!selectedFrameShowsSlideshow) {
      setSlideshowTargetPaperId?.(null);
      return;
    }

    // If we are in slideshow mode but the target differs, update it.
    if (
      selectedDevicePaperId &&
      slideshowTargetPaperId !== selectedDevicePaperId
    ) {
      // Only auto-set if currently enabled; keep user intent explicit.
      // (We don't enable slideshow mode automatically.)
      // no-op
    }
  }, [selectedDevicePaperId, selectedFrameShowsSlideshow]);

  const addToSlideshowEnabled =
    !isEditingSlidesIntegration &&
    Boolean(slideshowTargetPaperId) &&
    slideshowTargetPaperId === selectedDevicePaperId;

  const slideshowMetaLoaded =
    !addToSlideshowEnabled ||
    (slideshowTargetPaperQuery && slideshowTargetPaperQuery.isSuccess);

  const primaryLabel = addToSlideshowEnabled ? (
    <Trans>Add to slideshow</Trans>
  ) : (
    <Trans>Send</Trans>
  );

  return (
    <Modal
      open={isFrameSelectionOpen}
      modalHeading={<Trans>Send to frame</Trans>}
      primaryButtonText={primaryLabel}
      secondaryButtonText={<Trans>Back</Trans>}
      overscrollBehavior="inside"
      kindMobile="fullscreen"
      primaryButtonDisabled={
        !selectedFrameId ||
        isLoading ||
        (addToSlideshowEnabled &&
          (!selectedDevicePaperId ||
            selectedDevicePaperQuery.isLoading ||
            !slideshowMetaLoaded)) /*  || context?.isLoadingImageData */
      }
      onRequestSubmit={() => confirmFrameSelection(onRequestSubmit)}
      onRequestClose={() => setFrameSelectionOpen(false)}
    >
      {devices.isLoading ? (
        <InlineLoading />
      ) : devices.isError ? (
        <p className={styles.description}>
          <Trans>We could not load your frames. Please try again.</Trans>
        </p>
      ) : (
        <MultiCheckboxWrapper
          kind="vertical"
          labelText={<Trans>Picture frame</Trans>}
          helperText={
            <Trans>Choose which frame should receive this update.</Trans>
          }
        >
          {devices.data?.map((device) => {
            return (
              <MultiCheckbox
                key={device?.id}
                type="radio"
                name="frameSelection"
                value={device?.id}
                checked={selectedFrameId === device?.id}
                onChange={() => setSelectedFrameId(device?.id)}
                labelText={<DeviceName device={device} />}
                description={device?.meta?.location}
                icon={
                  <DeviceIcon
                    device={device?.kind}
                    className={styles.deviceIcon}
                  />
                }
                kind="vertical"
                fullWidth
              />
            );
          })}
        </MultiCheckboxWrapper>
      )}

      {selectedFrameId &&
        selectedFrameShowsSlideshow &&
        !isEditingSlidesIntegration && (
          <div style={{ marginTop: 16 }}>
            <MultiCheckboxWrapper
              kind="vertical"
              labelText={<Trans>Slideshow</Trans>}
              helperText={
                <Trans>
                  This frame is currently displaying a slideshow. You can add
                  the current image as a new slide instead of replacing the
                  slideshow.
                </Trans>
              }
            >
              <MultiCheckbox
                type="checkbox"
                name="addToSlideshow"
                value="true"
                checked={addToSlideshowEnabled}
                onChange={() => {
                  if (!setSlideshowTargetPaperId) return;
                  if (addToSlideshowEnabled) {
                    setSlideshowTargetPaperId(null);
                  } else if (selectedDevicePaperId) {
                    setSlideshowTargetPaperId(selectedDevicePaperId);
                  }
                }}
                labelText={<Trans>Add this image to slideshow</Trans>}
                kind="vertical"
                fullWidth
              />
            </MultiCheckboxWrapper>
          </div>
        )}
    </Modal>
  );
}
