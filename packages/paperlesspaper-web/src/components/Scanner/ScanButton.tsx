import React, { useState } from "react";
import { Modal, Button } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/pro-solid-svg-icons";
import styles from "./styles.module.scss";
import Scanner from "./";
import { Trans } from "react-i18next";
import classnames from "classnames";

export default function ScanButton({
  autoSubmit,
  buttonClassName,
  buttonText,
  dataTestId,
  description,
  setValue,
  scale,
  scanType,
  large,
  ...other
}: any) {
  const updateValue = (e) => {
    if (autoSubmit && e) {
      toggleModal();
      setTimeout(() => {
        setValue(e);
      }, 200);
    }
    return true;
  };

  const [content] = useState<any>();
  const [open, setOpen] = useState<boolean>();
  const [openFinished, setOpenFinished] = useState<boolean>();

  const toggleModal = () => {
    setOpen(!open);
  };

  const buttonClasses = classnames(styles.pictureButton, buttonClassName);

  return (
    <>
      <Button
        className={buttonClasses}
        large={large}
        icon={<FontAwesomeIcon icon={faQrcode} />}
        data-testid={dataTestId}
        onClick={() => {
          toggleModal();
          setOpenFinished(true);
        }}
        {...other}
      >
        {buttonText}
      </Button>
      <Modal
        lazyLoad={true}
        open={openFinished}
        // className={styles.modal}
        //TODO: check handleSubmit={prepareSubmit}
        modalHeading={<Trans>Scan code</Trans>}
        passiveModal={!content}
        primaryButtonText={<Trans>Submit</Trans>}
        secondaryButtonText={<Trans>Cancel</Trans>}
        kindMobile="fullscreen"
        className={styles.module}
        inPortal
        onRequestSubmit={toggleModal}
        onSecondarySubmit={toggleModal}
        onRequestClose={toggleModal}
      >
        <Scanner
          onChange={updateValue}
          open={open}
          kind={scanType}
          scale={scale}
          description={description}
          closeModal={() => setOpenFinished(false)}
        />
      </Modal>
    </>
  );
}
