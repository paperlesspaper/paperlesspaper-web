import React, { useEffect, useState } from "react";
import { Button, Modal, ModalWrapper, TextInput } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/pro-solid-svg-icons";
import { useHistory } from "react-router-dom";
import qs from "qs";
import styles from "./deleteModal.module.scss";

export function DeleteQuestionTitle({
  customDeleteQuestionTitle,
  name,
}: {
  customDeleteQuestionTitle: React.ReactNode;
  name: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      {customDeleteQuestionTitle || (
        <Trans i18nKey="deleteQuestionTitle">
          Delete {{ NAME: t(name + "-SINGULAR") }}
        </Trans>
      )}
    </>
  );
}

export function DeleteValidation({
  deleteValidationQuestionValue,
  deleteValidation,
}: any) {
  return (
    <>
      <TextInput
        className={styles.deleteValidation}
        labelText={
          <Trans i18nKey="DELETEVALIDATIONQUESTION">
            Enter {{ NAME: deleteValidationQuestionValue }} to confirm
          </Trans>
        }
        placeholder={deleteValidationQuestionValue}
        onChange={(e) => deleteValidation(e.target.value)}
      />
    </>
  );
}

export function DeleteQuestion({
  customDeleteQuestion,
  entryTitle,
  name,
}: any) {
  const { t } = useTranslation();
  return (
    <>
      {customDeleteQuestion ? (
        customDeleteQuestion
      ) : entryTitle ? (
        <Trans i18nKey="deleteQuestion">
          Are you sure that you want to delete {{ NAME: t(name) }}
        </Trans>
      ) : (
        <Trans>Are you sure that you want to delete the entry?</Trans>
      )}
    </>
  );
}

export default function DeleteModal({
  deleteEntry,
  deleteValidation: deleteValidationProp,
  deleteValidationQuestionValue,
  disableDelete = false,
  entryData,
  entryTitle,
  entryDataId,
  components: componentsOverride = {},
  customButton,
  customDeleteQuestion,
  customDeleteQuestionTitle,
  customDeleteButtonText,
  customDeleteRedirect,
  urlId,
  primaryButtonText = <Trans>Delete</Trans>,
  secondaryButtonText = <Trans>Cancel</Trans>,
  name,
  search,
  narrow,
  overviewUrl,
  resultDeleteSingle,
}: any) {
  const { t } = useTranslation();
  const history = useHistory();
  const [deleteValidationValue, setDeleteValidationValue] = useState();

  const deleteValidationQuestionValueCalc = deleteValidationQuestionValue;
  /*    ? deleteValidationQuestionValue
    : entryData?.name
    ? entryData?.name
    : t("DELETE")*/ const [open, setOpen] = useState(false);
  const defaultComponents = {
    DeleteQuestionTitle,
    DeleteQuestion,
    DeleteValidation,
  };

  const components = { ...defaultComponents, ...componentsOverride };

  const deleteValidationPropInternal = deleteValidationProp
    ? deleteValidationProp
    : (value) => {
        return value === deleteValidationQuestionValueCalc; //entryData?.name;
      };

  const pushOverview = () => {
    setOpen(false);

    const defaultRedirect = `${overviewUrl}/?${qs.stringify({
      ...search,
      deleted: "true",
    })}`;

    console.log("pushOverview", {
      overviewUrl,
      defaultRedirect,
      search,
      entryDataId,
    });
    if (customDeleteRedirect)
      customDeleteRedirect({ defaultRedirect, entryDataId });
    else history.push(defaultRedirect);
  };

  useEffect(() => {
    if (resultDeleteSingle?.data?.id) {
      setOpen(true);
    }
  }, [resultDeleteSingle?.data?.id]);

  if (open === true && resultDeleteSingle?.data?.id === urlId) {
    setTimeout(() => {
      //pushOverview();
    }, 2000);

    return (
      <Modal
        hideClose
        open
        onRequestSubmit={pushOverview}
        modalHeading={<Trans>Delete successful</Trans>}
        primaryButtonText={<Trans>Continue</Trans>}
      >
        <Trans>The entry was successfully deleted</Trans>
      </Modal>
    );
  }

  const deleteValidation = (value) => {
    setDeleteValidationValue(value);
  };

  return (
    <ModalWrapper
      modalHeading={
        <components.DeleteQuestionTitle
          entryData={entryData}
          customDeleteQuestionTitle={customDeleteQuestionTitle}
          name={name}
          urlId={urlId}
        />
      }
      primaryButtonText={
        resultDeleteSingle?.isLoading ? (
          <Trans>Loading...</Trans>
        ) : (
          primaryButtonText
        )
      }
      danger={deleteValidationQuestionValueCalc}
      primaryButtonDisabled={
        disableDelete ||
        resultDeleteSingle?.isLoading ||
        (deleteValidationQuestionValue &&
          deleteValidationPropInternal(deleteValidationValue) === false)
      }
      secondaryButtonText={secondaryButtonText}
      handleSubmit={() => deleteEntry(urlId)}
      //width="narrow"
      className={styles.deleteModal}
      customButton={
        customButton ? (
          customButton
        ) : (
          <Button
            kind="danger"
            id="deleteButton"
            data-testid="delete-button"
            //to={`${url}`}
            className="wfp--btn--danger--secondary"
            // icon={narrow ? <FontAwesomeIcon icon={faTrashAlt} /> : undefined}
          >
            {narrow == 3 ? undefined : customDeleteButtonText ? (
              customDeleteButtonText
            ) : (
              <Trans i18nKey="deleteName">
                Delete {{ NAME: t(name + "-SINGULAR") }}
              </Trans>
            )}
          </Button>
        )
      }
    >
      <components.DeleteQuestion
        customDeleteQuestion={customDeleteQuestion}
        entryTitle={entryTitle}
        entryData={entryData}
        name={name}
        urlId={urlId}
      />

      {deleteValidationQuestionValue && (
        <components.DeleteValidation
          customDeleteQuestion={customDeleteQuestion}
          deleteValidation={deleteValidation}
          deleteValidationQuestionValue={deleteValidationQuestionValue}
          entryTitle={entryTitle}
          entryData={entryData}
          name={name}
          urlId={urlId}
        />
      )}
    </ModalWrapper>
  );
}
