import { Button, InlineLoading, Modal } from "@progressiveui/react";
import DeviceIcon from "components/DeviceIcon";
import DeviceName from "components/DeviceName";
import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import { devicesApi } from "ducks/devices";
import { papersApi } from "ducks/ePaper/papersApi";
import { deviceByKind } from "helpers/devices/deviceList";
import React from "react";
import { Trans } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import useEditor from "../ImageEditor/useEditor";
import styles from "./integrationSend.module.scss";

const toggleSelectedId = (ids: string[], id?: string | null) => {
  if (!id) return ids;
  if (ids.includes(id)) {
    return ids.filter((selectedId) => selectedId !== id);
  }
  return [...ids, id];
};

export default function IntegrationSend({
  isPreparingFrameSelection = false,
  onRequestSubmit,
}: {
  isPreparingFrameSelection?: boolean;
  onRequestSubmit: () => void;
}) {
  const {
    setFrameSelectionOpen,
    isFrameSelectionOpen,
    selectedFrameIds = [],
    setSelectedFrameIds,
    selectedSlideshowIds = [],
    setSelectedSlideshowIds,
    selectedFrameKind,
    isLoading,
    confirmFrameSelection,
    form,
    overviewUrl,
  } = useEditor();

  const history = useHistory();
  const params = useParams<{
    organization: string;
    page: string;
    entry: string;
  }>();
  const { organization } = params;

  const currentPaperKind = form?.watch?.("kind");
  const isEditingSlidesIntegration = currentPaperKind === "slides";
  const formFrameKind = form?.watch?.("meta.frameKind");
  const targetFrameKind = formFrameKind || selectedFrameKind;

  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization },
  );
  const papers = papersApi.useGetAllPapersQuery(
    {
      organizationId: organization,
      queryOptions: {
        sortBy: "updatedAt:desc",
      },
    },
    { skip: !organization || isEditingSlidesIntegration },
  );

  const deviceById = React.useMemo(() => {
    const lookup: Record<string, any> = {};
    devices.data?.forEach((device: any) => {
      if (device?.id) {
        lookup[device.id] = device;
      }
    });
    return lookup;
  }, [devices.data]);

  const devicesByPaperId = React.useMemo(() => {
    const lookup: Record<string, any[]> = {};
    devices.data?.forEach((device: any) => {
      if (!device?.paper) return;
      const paperId = String(device.paper);
      lookup[paperId] = [...(lookup[paperId] || []), device];
    });
    return lookup;
  }, [devices.data]);

  const slideshows = React.useMemo(() => {
    if (isEditingSlidesIntegration) return [];
    return (papers.data || []).filter((paper: any) => paper?.kind === "slides");
  }, [isEditingSlidesIntegration, papers.data]);

  const targetKindName =
    targetFrameKind && (deviceByKind(targetFrameKind)?.name || targetFrameKind);

  const hasSelectedTargets =
    selectedFrameIds.length > 0 || selectedSlideshowIds.length > 0;

  const closeFrameSelection = React.useCallback(() => {
    if (isPreparingFrameSelection) return;
    setFrameSelectionOpen(false);
  }, [isPreparingFrameSelection, setFrameSelectionOpen]);

  const cancelToOverview = React.useCallback(() => {
    if (isPreparingFrameSelection) return;
    setFrameSelectionOpen(false);
    history.push(
      overviewUrl ||
        `/${params.organization}/${params.page}/device/${params.entry}`,
    );
  }, [
    history,
    overviewUrl,
    params.entry,
    params.organization,
    params.page,
    isPreparingFrameSelection,
    setFrameSelectionOpen,
  ]);

  const SendModalFooter = React.useCallback(
    ({ primaryButtonDisabled, onRequestSubmit: onSubmit }: any) => (
      <div className="wfp--modal-footer">
        <div className={`wfp--modal__buttons-container ${styles.footer}`}>
          <Button
            kind="secondary"
            disabled={isPreparingFrameSelection}
            onClick={closeFrameSelection}
          >
            <Trans>Back</Trans>
          </Button>
          {/* <Button kind="secondary" onClick={cancelToOverview}>
            <Trans>Cancel</Trans>
          </Button> */}
          <Button disabled={primaryButtonDisabled} onClick={onSubmit}>
            <Trans>Send</Trans>
          </Button>
        </div>
      </div>
    ),
    [closeFrameSelection, isPreparingFrameSelection],
  );

  return (
    <Modal
      open={isFrameSelectionOpen}
      modalHeading={<Trans>Send to</Trans>}
      primaryButtonText={<Trans>Send</Trans>}
      secondaryButtonText={<Trans>Back</Trans>}
      overscrollBehavior="inside"
      kindMobile="fullscreen"
      primaryButtonDisabled={
        !hasSelectedTargets ||
        isPreparingFrameSelection ||
        isLoading ||
        (selectedSlideshowIds.length > 0 && papers.isLoading)
      }
      onRequestSubmit={() => {
        if (isPreparingFrameSelection) return;
        confirmFrameSelection(onRequestSubmit);
      }}
      onSecondarySubmit={closeFrameSelection}
      onRequestClose={cancelToOverview}
      components={{ ModalFooter: SendModalFooter as any }}
    >
      {isPreparingFrameSelection && (
        <InlineLoading
          className={styles.preparing}
          description={<Trans>Preparing image...</Trans>}
        />
      )}

      {devices.isLoading ? (
        <InlineLoading />
      ) : devices.isError ? (
        <p className={styles.description}>
          <Trans>We could not load your frames. Please try again.</Trans>
        </p>
      ) : (
        <MultiCheckboxWrapper
          className={styles.targetGroup}
          kind="vertical"
          labelText={<Trans>Picture Frame</Trans>}
          helperText={<Trans>Frames that should display this.</Trans>}
        >
          {(devices.data || []).map((device: any) => {
            const incompatible =
              targetFrameKind && device?.kind !== targetFrameKind;

            return (
              <MultiCheckbox
                key={device?.id}
                type="checkbox"
                name="frameSelection"
                value={device?.id}
                checked={selectedFrameIds.includes(device?.id)}
                onChange={() => {
                  setSelectedFrameIds?.((currentFrameIds) =>
                    toggleSelectedId(currentFrameIds, device?.id),
                  );

                  if (!targetFrameKind && device?.kind) {
                    form?.setValue?.("meta.frameKind", device.kind, {
                      shouldDirty: false,
                    });
                  }
                }}
                labelText={<DeviceName device={device} />}
                description={
                  <span className={styles.targetMeta}>
                    {device?.meta?.location && (
                      <span>{device.meta.location}</span>
                    )}
                    {incompatible && (
                      <span className={styles.warningText}>
                        <Trans>Different size</Trans>
                        {targetKindName && (
                          <>
                            {" "}
                            (
                            <Trans values={{ kind: targetKindName }}>
                              expected {{ kind: targetKindName }}
                            </Trans>
                            )
                          </>
                        )}
                      </span>
                    )}
                  </span>
                }
                icon={
                  <DeviceIcon
                    device={device?.kind}
                    className={styles.deviceIcon}
                  />
                }
                className={incompatible ? styles.incompatibleOption : undefined}
                kind="vertical"
                fullWidth
              />
            );
          })}

          {!devices.data?.length && (
            <p className={styles.description}>
              <Trans>No frames found.</Trans>
            </p>
          )}
        </MultiCheckboxWrapper>
      )}

      {!isEditingSlidesIntegration && (
        <div className={styles.slideshowSection}>
          {papers.isLoading ? (
            <InlineLoading />
          ) : papers.isError ? (
            <p className={styles.description}>
              <Trans>
                We could not load your slideshows. Please try again.
              </Trans>
            </p>
          ) : (
            <MultiCheckboxWrapper
              className={styles.targetGroup}
              kind="vertical"
              labelText={<Trans>Slideshow</Trans>}
              helperText={
                <Trans>
                  Slideshows to add this item to. Existing display status will
                  not change.
                </Trans>
              }
            >
              {slideshows.map((slideshow: any) => {
                const activeDevices =
                  devicesByPaperId[String(slideshow.id)] || [];
                const activeFrameNames = activeDevices
                  .map(
                    (device) =>
                      device?.name || device?.deviceId || device?.id || "",
                  )
                  .filter(Boolean)
                  .join(", ");
                const slideshowDevice = slideshow.deviceId
                  ? deviceById[slideshow.deviceId]
                  : null;
                const slideshowFrameKind =
                  slideshow.meta?.frameKind || slideshowDevice?.kind;
                const incompatible =
                  targetFrameKind &&
                  slideshowFrameKind &&
                  slideshowFrameKind !== targetFrameKind;

                return (
                  <MultiCheckbox
                    key={slideshow.id}
                    type="checkbox"
                    name="slideshowSelection"
                    value={slideshow.id}
                    checked={selectedSlideshowIds.includes(slideshow.id)}
                    onChange={() =>
                      setSelectedSlideshowIds?.((currentSlideshowIds) =>
                        toggleSelectedId(currentSlideshowIds, slideshow.id),
                      )
                    }
                    labelText={slideshow.name || <Trans>Slideshow</Trans>}
                    description={
                      <span className={styles.targetMeta}>
                        {activeFrameNames ? (
                          <span className={styles.activeText}>
                            <Trans values={{ frame: activeFrameNames }}>
                              Active on {{ frame: activeFrameNames }}
                            </Trans>
                          </span>
                        ) : (
                          <span>
                            <Trans>Not currently active</Trans>
                          </span>
                        )}
                        {incompatible && (
                          <span className={styles.warningText}>
                            <Trans>Different size</Trans>
                            {targetKindName && (
                              <>
                                {" "}
                                (
                                <Trans values={{ kind: targetKindName }}>
                                  expected {{ kind: targetKindName }}
                                </Trans>
                                )
                              </>
                            )}
                          </span>
                        )}
                      </span>
                    }
                    icon={
                      slideshowFrameKind ? (
                        <DeviceIcon
                          device={slideshowFrameKind}
                          className={styles.deviceIcon}
                        />
                      ) : undefined
                    }
                    className={[
                      activeFrameNames ? styles.activeOption : "",
                      incompatible ? styles.incompatibleOption : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    kind="vertical"
                    fullWidth
                  />
                );
              })}

              {!slideshows.length && (
                <p className={styles.description}>
                  <Trans>No slideshows found.</Trans>
                </p>
              )}
            </MultiCheckboxWrapper>
          )}
        </div>
      )}
    </Modal>
  );
}
