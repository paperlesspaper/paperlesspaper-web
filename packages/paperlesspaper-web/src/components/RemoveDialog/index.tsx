import React from "react";
import { Button, ModalWrapper } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";

export default function RemoveDialog({
  buttonText,

  name,
  customButton,
  onSubmit,
}: any) {
  const { t } = useTranslation();

  return (
    <ModalWrapper
      modalHeading={t("Remove {{name}}", { name })}
      primaryButtonText={t("Remove")}
      handleSubmit={onSubmit}
      customButton={
        customButton ? (
          customButton
        ) : (
          <Button kind="danger--primary">
            {buttonText ? t(buttonText) : t("Remove {{name}}", { name })}
          </Button>
        )
      }
    >
      <Trans
        i18nKey="Are you sure that you want to remove {{name}}?"
        values={{ name }}
      />
    </ModalWrapper>
  );
}
