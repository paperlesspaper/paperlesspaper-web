import { InlineLoading, Modal } from "@progressiveui/react";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import { useHistory } from "react-router-dom";
import PhotoFrame from "../Overview/PhotoFrame";
import styles from "./integrationModal.module.scss";
import { EditorContext } from "./ImageEditor/Editor";
import { Button, useTheme } from "@progressiveui/react";
import { papersApi } from "ducks/papersApi";
import { useActiveUser, useActiveUserDevice } from "helpers/useUsers";
import useQs from "helpers/useQs";
import QueryString from "qs";

const ModalFooter: React.FC<any> = ({
  passiveModal,
  secondaryButtonText,
  onSecondaryButtonClick,
  primaryButtonText,
  onRequestSubmit,
  primaryButtonDisabled,
  secondaryButtonDisabled,
  danger,
  primaryButtonRef,
  secondaryButtonRef,
}) => {
  const { prefix } = useTheme();
  if (passiveModal) return null;

  return (
    <div className={`${prefix}--modal-footer`}>
      <div className={`${prefix}--modal__buttons-container`}>
        {/* secondaryButtonText && (
          <Button
            kind="secondary"
            disabled={secondaryButtonDisabled}
            id="secondaryButton"
            onClick={(e) => {
              if (onSecondaryButtonClick) onSecondaryButtonClick(e, "button");
            }}
            ref={secondaryButtonRef as React.Ref<HTMLButtonElement>}
          >
            {secondaryButtonText}
          </Button>
        ) */}
        <Button
          kind={danger ? "danger" : "primary"}
          disabled={primaryButtonDisabled}
          onClick={onRequestSubmit}
          id="primaryButton"
          ref={primaryButtonRef as React.Ref<HTMLButtonElement>}
        >
          {primaryButtonText}
        </Button>
      </div>
    </div>
  );
};

export default function IntegrationModal({
  components,
  children,
  elements,
  context,
  store,
  openPreviewImage = () => {},
  containerRef,
  passiveModal,
  showEmpty,
  ...props
}: any) {
  const history = useHistory();
  const Elements = elements;

  const [isDoneModal, setDoneModal] = React.useState(false);

  const activeUserDevices = useActiveUserDevice();

  const papers = papersApi.useGetAllPapersQuery(
    {
      deviceId: activeUserDevices.data?.id,
      queryOptions: {
        deviceId: activeUserDevices.data?.id,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: activeUserDevices.data?.id === undefined,
    }
  );

  const hasOnlyOnePaper = papers.data?.length <= 1;

  const queryString = useQs();

  useEffect(() => {
    if (store.done === true) {
      if (hasOnlyOnePaper) {
        setDoneModal(true);
      } else {
        if (store.resultCreateSingle?.originalArgs?.draft === true) {
          history.push(
            `/${store.params.organization}/calendar/device/${store.params.entry}/${store.resultCreateSingle.data.id}?${QueryString.stringify(queryString)}`
          );
        } else if (store.resultUpdateSingle?.originalArgs?.draft === true) {
          console.log("store.resultUpdateSingle", store.resultUpdateSingle);
        } else {
          history.push(store.overviewUrl);
        }
      }
    }
  }, [store.done]);

  return (
    <EditorContext.Provider value={context || store}>
      {store.isLoading && (
        <div className={styles.saving}>
          <div className={styles.savingInside}>
            <InlineLoading />
          </div>
        </div>
      )}

      <Modal
        open={isDoneModal}
        modalHeading={<Trans>Update done</Trans>}
        primaryButtonText={<Trans>Continue</Trans>}
        onRequestSubmit={() => history.push(store.overviewUrl)}
        onRequestClose={() => history.push(store.overviewUrl)}
      >
        <p className={styles.description}>
          <Trans>
            Press the button on the back of the device to immediately see the
            changes or wait until the next update.
          </Trans>
        </p>
      </Modal>

      <Modal
        modalHeading="Integration"
        primaryButtonText={<Trans>Submit</Trans>}
        secondaryButtonText={passiveModal ? undefined : <Trans>Preview</Trans>}
        //  components={{ ModalFooter }}
        onRequestClose={(evt, trigger) => {
          if (trigger === undefined) {
            openPreviewImage();
          }
          if (trigger === "button")
            history.push(
              `/${store.params.organization}/calendar/device/${store.params.entry}`
            );
        }}
        onSecondarySubmit={openPreviewImage}
        onRequestSubmit={store.handleSubmit(store.onSubmit)}
        open
        inPortal={false}
        {...props}
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
          <div className={styles.edit}>
            <Elements />
          </div>
        </>
      </Modal>
    </EditorContext.Provider>
  );
}
