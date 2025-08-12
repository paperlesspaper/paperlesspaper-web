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
  onClick,
  id,
  modalKind = "modal",
  ...other
}: any) {
  const { darkMode, setModalOpen, modalOpen } = useEditor();
  const ModalComponent = modalComponent;

  const classes = classnames(styles.modal, {
    "force-darkmode": darkMode,
  });

  return (
    <div className={styles.editorButton}>
      <Button
        kind="secondary"
        onClick={(e) => (modalComponent ? setModalOpen(id) : onClick(e))}
        {...other}
        className={styles.button}
      />
      <div className={styles.text}>{text}</div>

      {modalOpen === id && modalKind === "slider" && (
        <div className={styles.slider}>
          <div className={styles.sliderContent}>
            <ModalComponent modalOpen={modalOpen} setModalOpen={setModalOpen} />
          </div>
        </div>
      )}

      {modalOpen === id && modalKind === "modal" && ModalComponent && (
        <Modal
          open
          className={classes}
          modalHeading={modalHeading}
          onRequestSubmit={() => setModalOpen(false)}
          onSecondarySubmit={() => setModalOpen(false)}
          onRequestClose={() => setModalOpen(false)}
          primaryButtonText={<Trans>Continue</Trans>}
        >
          <ModalComponent
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            {...other}
          />
        </Modal>
      )}
    </div>
  );
}
