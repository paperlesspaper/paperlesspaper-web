import React from "react";
import { Button, ModalWrapper } from "@progressiveui/react";
import { Trans } from "react-i18next";

export default function RemoveDialog({
  buttonText,

  name,
  customButton,
  onSubmit,
}: any) {
  return (
    <ModalWrapper
      modalHeading={`Remove ${name}`}
      primaryButtonText="Remove"
      handleSubmit={onSubmit}
      customButton={
        customButton ? (
          customButton
        ) : (
          <Button kind="danger--primary">
            <Trans>{buttonText ? buttonText : `Remove ${name}`}</Trans>
          </Button>
        )
      }
    >
      <Trans>Are you sure that you want to delete the {name}?</Trans>
    </ModalWrapper>
  );
}
