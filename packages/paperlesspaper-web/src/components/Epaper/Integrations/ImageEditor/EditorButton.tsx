import { Button, Modal } from "@progressiveui/react";
import React from "react";
import styles from "./editorButton.module.scss";
import { Trans } from "react-i18next";
import useEditor from "./useEditor";
import classnames from "classnames";

export default function EditorButton({
  text,
  modalComponent,
  modalHeading,
  modalClassName,
  onClick,
  id,
  modalKind = "modal",
  modalProps = {},
  ...other
}: any) {
  const { darkMode, setModalOpen, modalOpen } = useEditor();
  const ModalComponent = modalComponent;
  const primaryActionRef = React.useRef<null | (() => void | Promise<void>)>(
    null,
  );

  const {
    onRequestClose: modalOnRequestClose,
    onRequestSubmit: modalOnRequestSubmit,
    onSecondarySubmit: modalOnSecondarySubmit,
    ...restModalProps
  } = modalProps;

  const classes = classnames(
    styles.modal,
    {
      "force-darkmode": darkMode,
    },
    modalClassName,
  );

  const registerPrimaryAction = React.useCallback(
    (fn: null | (() => void | Promise<void>)) => {
      primaryActionRef.current = fn;
    },
    [],
  );

  const handleRequestSubmit = React.useCallback(async () => {
    try {
      await primaryActionRef.current?.();
      await modalOnRequestSubmit?.();
      setModalOpen(false);
    } catch (e) {
      // keep the modal open if the action fails
      console.error(e);
    }
  }, [modalOnRequestSubmit, setModalOpen]);

  const handleSecondarySubmit = React.useCallback(
    async (...args: any[]) => {
      try {
        await modalOnSecondarySubmit?.(...args);
      } finally {
        setModalOpen(false);
      }
    },
    [modalOnSecondarySubmit, setModalOpen],
  );

  const handleRequestClose = React.useCallback(
    async (...args: any[]) => {
      try {
        await modalOnRequestClose?.(...args);
      } finally {
        setModalOpen(false);
      }
    },
    [modalOnRequestClose, setModalOpen],
  );

  return (
    <div className={styles.editorButton}>
      <Button
        kind="secondary"
        onClick={(e) => (modalComponent ? setModalOpen(id) : onClick(e))}
        {...other}
        className={styles.button}
        iconReverse
      >
        <span className={styles.text}>{text}</span>
      </Button>

      {modalOpen === id && modalKind === "slider" && (
        <div className={styles.slider}>
          <div className={styles.sliderContent}>
            {React.isValidElement(modalComponent) ? (
              modalComponent
            ) : (
              <ModalComponent
                modalOpen={modalOpen}
                setModalOpen={setModalOpen}
              />
            )}
          </div>
        </div>
      )}

      {modalOpen === id && modalKind === "modal" && ModalComponent && (
        <Modal
          open
          className={classes}
          modalHeading={modalHeading}
          onRequestSubmit={handleRequestSubmit}
          onSecondarySubmit={handleSecondarySubmit}
          onRequestClose={handleRequestClose}
          primaryButtonText={<Trans>Continue</Trans>}
          overscrollBehavior="inside"
          kindMobile="fullscreen"
          {...restModalProps}
        >
          {React.isValidElement(modalComponent) ? (
            modalComponent
          ) : (
            <ModalComponent
              modalOpen={modalOpen}
              setModalOpen={setModalOpen}
              registerPrimaryAction={registerPrimaryAction}
              {...other}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
