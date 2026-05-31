import { Button } from "@progressiveui/react";
import React from "react";
import styles from "./editorButton.module.scss";
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
  const {
    clearEditorDetails,
    darkMode,
    modalOpen,
    setEditorDetails,
    setModalOpen,
  } = useEditor();
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

  const renderDetails = () => {
    if (React.isValidElement(modalComponent)) {
      return modalComponent;
    }

    if (!ModalComponent) return null;

    if (modalKind === "slider") {
      return (
        <ModalComponent modalOpen={modalOpen} setModalOpen={setModalOpen} />
      );
    }

    return (
      <ModalComponent
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        registerPrimaryAction={registerPrimaryAction}
        {...other}
      />
    );
  };

  const hasModalComponent = Boolean(modalComponent);

  const latestDetailsRef = React.useRef({
    classes,
    handleRequestClose,
    handleRequestSubmit,
    handleSecondarySubmit,
    modalHeading,
    modalProps: restModalProps,
    renderDetails,
  });

  latestDetailsRef.current = {
    classes,
    handleRequestClose,
    handleRequestSubmit,
    handleSecondarySubmit,
    modalHeading,
    modalProps: restModalProps,
    renderDetails,
  };

  React.useEffect(() => {
    if (!hasModalComponent || modalOpen !== id || !setEditorDetails) return;

    setEditorDetails({
      id,
      kind: modalKind,
      className: latestDetailsRef.current.classes,
      modalHeading: latestDetailsRef.current.modalHeading,
      modalProps: latestDetailsRef.current.modalProps,
      render: () => latestDetailsRef.current.renderDetails(),
      onRequestClose: (...args: any[]) =>
        latestDetailsRef.current.handleRequestClose(...args),
      onRequestSubmit: () => latestDetailsRef.current.handleRequestSubmit(),
      onSecondarySubmit: (...args: any[]) =>
        latestDetailsRef.current.handleSecondarySubmit(...args),
    });

    return () => clearEditorDetails?.(id);
  }, [
    clearEditorDetails,
    hasModalComponent,
    id,
    modalKind,
    modalOpen,
    setEditorDetails,
  ]);

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
    </div>
  );
}
