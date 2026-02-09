import React from "react";
import CrudButton from "components/CrudButton";
import { Trans, useTranslation } from "react-i18next";
import { useSettingsContent } from "../SettingsContentContext";
import { useIsDesktop } from "@internetderdinge/web";
interface SettingsSubmitButtonProps {
  loadingCrud?: boolean;
  dataTestId?: string;
  name?: string;
  title?: React.ReactNode;
  kind?: "primary" | "danger--primary";
  urlId?: string;
  href?: string;
  submitButtonTitle?: React.ReactNode;
  large?: boolean;
  hideSubmitButton?: boolean;
  resultCreateSingle?: any;
  resultUpdateSingle?: any;
  icon?: React.ReactNode;
}

const SettingsSubmitButton = ({
  title /*
  dataTestId = "crud-submit-button",
  loadingCrud,
  name,
  title,
  urlId,
  resultCreateSingle,
  resultUpdateSingle,
  ...other */,
}: SettingsSubmitButtonProps) => {
  const { t } = useTranslation();
  const {
    dataTestId = "crud-submit-button",
    loadingCrud,
    name,
    // title,
    urlId,
    hideSubmitButton,
    resultCreateSingle,
    resultUpdateSingle,
    submitButtonTitle,
    ...other
  }: SettingsSubmitButtonProps = useSettingsContent();

  const isDesktop = useIsDesktop();
  //const title = undefined;

  if (hideSubmitButton) return null;

  return (
    <CrudButton
      type="submit"
      data-testid={dataTestId}
      form="settings-form"
      wrapper={isDesktop ? "inline" : "link"}
      loading={
        loadingCrud ||
        resultCreateSingle?.isLoading ||
        resultUpdateSingle?.isLoading
      }
      {...other}
    >
      {title ? (
        title
      ) : submitButtonTitle ? (
        submitButtonTitle
      ) : urlId === "new" ? (
        <Trans i18nKey="AddNewNameSingular">
          Create {{ NAME: t(`${name}-SINGULAR`) }}
        </Trans>
      ) : (
        <Trans i18nKey="UpdateNameSingular">
          Update {{ NAME: t(`${name}-SINGULAR`) }}
        </Trans>
      )}
    </CrudButton>
  );
};

export default SettingsSubmitButton;
