import { Modal } from "@progressiveui/react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import React, { isValidElement, useEffect, useRef } from "react";
import { Trans } from "react-i18next";
import { Prompt, useHistory, useLocation } from "react-router-dom";
import i18next from "i18next";
import PhotoFrame from "../Overview/PhotoFrame";
import styles from "./integrationModal.module.scss";
import { useActiveUserDevice } from "helpers/useUsers";
import useQs from "helpers/useQs";
import QueryString from "qs";
import IntegrationSend from "./IntegrationWrapper/IntegrationSend";
import {
  EditorContextType,
  EditorDetailsConfig,
} from "./ImageEditor/useEditor";
import OverlayLoading from "components/OverlayLoading";
import classnames from "classnames";

export const EditorContext = React.createContext<EditorContextType | null>(
  null,
);

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      setTimeout(resolve, 0);
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

export default function IntegrationModal({
  components,
  children,
  elements,
  // context,
  store,
  openPreviewImage = () => {},
  passiveModal,
  modalHeading,
  showEmpty,
  beforeFrameSelection,
  isLoadingImageData,
  onRequestCloseOverride,
  open = true,
  inline = false,
  modalKind,
  modalClassName,
  primaryButtonDisabled,
}: any) {
  const history = useHistory();
  const location = useLocation();
  const Elements = elements;

  const activeUserDevices = useActiveUserDevice();

  const previousStatusBarStyle = useRef<Style | null>(null);
  const [isPreparingFrameSelection, setIsPreparingFrameSelection] =
    React.useState(false);
  const [editorDetails, setEditorDetails] =
    React.useState<EditorDetailsConfig | null>(null);

  const clearEditorDetails = React.useCallback((id?: string) => {
    setEditorDetails((currentDetails) => {
      if (!currentDetails) return null;
      if (id && currentDetails.id !== id) return currentDetails;
      return null;
    });
  }, []);

  const editorContextValue = React.useMemo(
    () => ({
      ...store,
      editorDetails,
      setEditorDetails,
      clearEditorDetails,
    }),
    [store, editorDetails, clearEditorDetails],
  );

  const setStatusBarDark = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const info = await StatusBar.getInfo();
      previousStatusBarStyle.current = info.style ?? null;
    } catch (error) {
      console.warn("StatusBar.getInfo failed", error);
    }
    await StatusBar.setStyle({ style: Style.Dark });
  };

  useEffect(() => {
    store.form.setValue("meta.url", "https://paperlesspaper.de");
  }, []);

  const restoreStatusBarStyle = async () => {
    if (!Capacitor.isNativePlatform()) return;
    if (previousStatusBarStyle.current) {
      await StatusBar.setStyle({ style: previousStatusBarStyle.current });
    }
  };

  useEffect(() => {
    if (!store.done && !store.isFrameSelectionOpen) {
      setStatusBarDark();
    } else {
      restoreStatusBarStyle();
    }

    return () => {
      restoreStatusBarStyle();
    };
  }, [store.done, store.isFrameSelectionOpen]);

  useEffect(() => {
    if (activeUserDevices.data?.id) {
      store.setSelectedFrameId(activeUserDevices.data.id);
    }
  }, [activeUserDevices.data?.id]);

  const queryString = useQs();

  useEffect(() => {
    if (store.done === true) {
      const nextQueryString = {
        ...queryString,
        frameKind:
          store.selectedFrameKind || store.form.getValues?.("meta.frameKind"),
      };

      /*if (hasOnlyOnePaper) {
        store.setDoneModal(true);
      } else {*/
      if (store.resultCreateSingle?.originalArgs?.draft === true) {
        history.push(
          `/${store.params.organization}/${store.params.page}/device/${store.params.entry}/${store.resultCreateSingle.data?.id}?${QueryString.stringify(nextQueryString)}`,
        );
      } else if (store.resultUpdateSingle?.originalArgs?.draft === true) {
        console.log("store.resultUpdateSingle", store.resultUpdateSingle);
      } else {
        history.push(store.overviewUrl);
      }
      //}
    }
  }, [store.done]);

  const submitForm = store.handleSubmit((values) => {
    const selectedFrameIds = store.selectedFrameIds || [];

    const targetDeviceId =
      selectedFrameIds[0] ||
      values.meta?.deviceId ||
      store.entryData?.deviceId ||
      activeUserDevices.data?.id;

    const meta = {
      ...(values.meta || {}),
      deviceId: targetDeviceId,
    };

    return store.onSubmit({ ...values, meta });
  });

  const openFrameSelection = () => {
    if (isPreparingFrameSelection) return;

    store.setFrameSelectionOpen(true);

    if (!beforeFrameSelection) return;

    setIsPreparingFrameSelection(true);
    void waitForNextPaint()
      .then(() => beforeFrameSelection())
      .then((result) => {
        if (result === null) {
          store.setFrameSelectionOpen(false);
        }
      })
      .catch((error) => {
        console.error("Failed to prepare frame selection", error);
        store.setFrameSelectionOpen(false);
      })
      .finally(() => {
        setIsPreparingFrameSelection(false);
      });
  };

  console.log("store.done", store.params);

  const modalClasses = classnames(styles.integrationModal, modalClassName);

  return (
    <EditorContext.Provider value={editorContextValue}>
      <Prompt
        when={
          !store.disableClosePrompt &&
          store.isDirtyAlt === true &&
          !(store.resultCreateSingle?.data?.id && store.urlId === "new")
        }
        message={(nextLocation) => {
          if ((nextLocation.state as any)?.skipUnsavedPrompt) {
            return true;
          }

          return nextLocation.pathname === location.pathname
            ? true
            : i18next.t(`Are you sure you want to go to?`);
        }}
      />
      {store.isLoading && (
        <OverlayLoading description={<Trans>Saving...</Trans>} fullscreen />
      )}
      {isLoadingImageData && (
        <OverlayLoading description={<Trans>Loading...</Trans>} fullscreen />
      )}

      {!store.done && (
        <>
          <Modal
            open={store.isDoneModal}
            modalHeading={<Trans>Update done</Trans>}
            primaryButtonText={<Trans>Continue</Trans>}
            onRequestSubmit={() => history.push(store.overviewUrl)}
            onRequestClose={() => history.push(store.overviewUrl)}
          >
            <p className={styles.description}>
              <Trans>
                Press the button on the back of the device to immediately see
                the changes or wait until the next update.
              </Trans>
            </p>
          </Modal>
          <IntegrationSend
            onRequestSubmit={submitForm}
            isPreparingFrameSelection={isPreparingFrameSelection}
          />

          {editorDetails?.kind === "modal" && (
            <Modal
              open
              className={editorDetails.className}
              modalHeading={editorDetails.modalHeading}
              onRequestSubmit={editorDetails.onRequestSubmit}
              onSecondarySubmit={editorDetails.onSecondarySubmit}
              onRequestClose={editorDetails.onRequestClose}
              primaryButtonText={<Trans>Continue</Trans>}
              overscrollBehavior="inside"
              kindMobile="fullscreen"
              {...editorDetails.modalProps}
            >
              {editorDetails.render()}
            </Modal>
          )}

          {inline ? (
            children
          ) : (
            <Modal
              modalHeading={modalHeading}
              primaryButtonText={<Trans>Continue</Trans>}
              primaryButtonDisabled={
                store.isLoading ||
                isLoadingImageData ||
                isPreparingFrameSelection ||
                primaryButtonDisabled
              }
              className={modalClasses}
              secondaryButtonText={
                passiveModal ? undefined : <Trans>Preview</Trans>
              }
              kind={
                modalKind ||
                (store?.entryData.kind === "image" ||
                store.params.paperKind === "image"
                  ? "fullscreen"
                  : undefined)
              }
              kindMobile="fullscreen"
              overscrollBehavior="inside"
              onRequestClose={(evt, trigger) => {
                if (onRequestCloseOverride) {
                  onRequestCloseOverride(evt, trigger);
                  return;
                }
                if (trigger === undefined) {
                  openPreviewImage();
                }
                if (trigger === "button")
                  history.push(
                    `/${store.params.organization}/${store.params.page}/device/${store.params.entry}`,
                  );
              }}
              onSecondarySubmit={openPreviewImage}
              onRequestSubmit={() => openFrameSelection()}
              open={open}
              inPortal={false}
            >
              <>
                {children ? (
                  children
                ) : (
                  <PhotoFrame
                    components={components}
                    paper={store.entryData}
                    preview
                    hideEdit
                    showEmpty={showEmpty}
                    store={store}
                  />
                )}
                {editorDetails?.kind === "slider" && (
                  <div className={styles.editDetails}>
                    <div className={styles.editDetailsContent}>
                      {editorDetails.render()}
                    </div>
                  </div>
                )}
                {Elements && (
                  <div className={styles.edit}>
                    {isValidElement(elements) ? elements : <Elements />}
                  </div>
                )}
              </>
            </Modal>
          )}
        </>
      )}
    </EditorContext.Provider>
  );
}
