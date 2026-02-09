import { InlineLoading, Modal } from "@progressiveui/react";
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
import { EditorContextType } from "./ImageEditor/useEditor";
import OverlayLoading from "components/OverlayLoading";
import { isValid } from "date-fns";

export const EditorContext = React.createContext<EditorContextType | null>(
  null,
);

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
  setIsLoadingImageData,
  isLoadingImageData,
}: any) {
  const history = useHistory();
  const location = useLocation();
  const Elements = elements;

  const activeUserDevices = useActiveUserDevice();

  const previousStatusBarStyle = useRef<Style | null>(null);

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
      /*if (hasOnlyOnePaper) {
        store.setDoneModal(true);
      } else {*/
      if (store.resultCreateSingle?.originalArgs?.draft === true) {
        history.push(
          `/${store.params.organization}/${store.params.page}/device/${store.params.entry}/${store.resultCreateSingle.data?.id}?${QueryString.stringify(queryString)}`,
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
    const isSlideshowAdd = Boolean(store.slideshowTargetPaperId);

    // If we’re adding to a slideshow, do not assign the current paper to the selected frame.
    // Otherwise the backend would set device.paper to this paper and replace the slideshow.
    const targetDeviceId = isSlideshowAdd
      ? store.entryData?.deviceId || activeUserDevices.data?.id
      : store.selectedFrameId || activeUserDevices.data?.id;

    const meta = {
      ...(values.meta || {}),
      deviceId: targetDeviceId,
    };

    return store.onSubmit({ ...values, meta });
  });

  const openFrameSelection = () => {
    if (beforeFrameSelection) beforeFrameSelection();
    store.setFrameSelectionOpen(true);
  };

  console.log("store.done", store.params);

  return (
    <EditorContext.Provider value={store}>
      <Prompt
        when={
          !store.disableClosePrompt &&
          store.isDirtyAlt === true &&
          !(store.resultCreateSingle?.data?.id && store.urlId === "new")
        }
        message={(nextLocation) =>
          nextLocation.pathname === location.pathname
            ? true
            : i18next.t(`Are you sure you want to go to?`)
        }
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
          <IntegrationSend onRequestSubmit={submitForm} />

          <Modal
            modalHeading={modalHeading}
            primaryButtonText={<Trans>Continue</Trans>}
            primaryButtonDisabled={store.isLoading || isLoadingImageData}
            className={styles.integrationModal}
            secondaryButtonText={
              passiveModal ? undefined : <Trans>Preview</Trans>
            }
            kind={
              store?.entryData.kind === "image" ||
              store.params.paperKind === "image"
                ? "fullscreen"
                : undefined
            }
            kindMobile="fullscreen"
            overscrollBehavior="inside"
            onRequestClose={(evt, trigger) => {
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
            open
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
              {Elements && (
                <div className={styles.edit}>
                  {isValidElement(elements) ? elements : <Elements />}
                </div>
              )}
            </>
          </Modal>
        </>
      )}
    </EditorContext.Provider>
  );
}
