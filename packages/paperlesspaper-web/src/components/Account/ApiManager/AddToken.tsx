import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, Modal, Story, TextInput } from "@progressiveui/react";
import TextInputWithCopy from "components/inputs/TextInputWithCopy";
import { tokensApi } from "ducks/tokens";
import i18next from "i18next";
import React from "react";
import { Trans } from "react-i18next";

export default function AddToken({ open, setOpen }: any) {
  const [createToken, createTokenResult] =
    tokensApi.useCreateSingleTokensMutation();

  const [tokenDescription, setTokenDescription] = React.useState("");

  const submitToken = async () => {
    try {
      await createToken({ values: { name: tokenDescription } });
    } catch (error) {
      console.error("Error creating token:", error);
    }
  };

  const finishTokenCreation = () => {
    setOpen(false);
    setTokenDescription("");
    createTokenResult.reset();
    console.log("Token creation finished");
  };

  console.log("createTokenResult", createTokenResult);

  return (
    <>
      {createTokenResult.isSuccess ? (
        <Modal
          open={open && createTokenResult.isSuccess}
          onRequestClose={finishTokenCreation}
          onRequestSubmit={finishTokenCreation}
          modalHeading={<Trans>Create new API token</Trans>}
          primaryButtonText={<Trans>Close</Trans>}
        >
          <Story>
            <Callout
              kind="success"
              title={<Trans>Your new token has been generated</Trans>}
            >
              <Trans>
                Please copy and store the token securely now, as this message
                will only appear once.
              </Trans>
            </Callout>

            <TextInputWithCopy
              id="token"
              labelText="Token"
              readOnly
              value={createTokenResult.data?.raw || ""}
              copyButtonText={<Trans>Copy</Trans>}
              tooltipContent={(copied) =>
                copied ? (
                  <Trans>Token copied</Trans>
                ) : (
                  <Trans>Click to copy token...</Trans>
                )
              }
            />
          </Story>
        </Modal>
      ) : open ? (
        <Modal
          open={open}
          onRequestClose={() => setOpen(false)}
          onRequestSubmit={submitToken}
          modalHeading={<Trans>Create new API token</Trans>}
          primaryButtonText={<Trans>Create</Trans>}
        >
          <TextInput
            id="token"
            labelText={<Trans>Description</Trans>}
            helperText={
              <Trans>
                Please provide a description. This will help you identify its
                purpose later.
              </Trans>
            }
            placeholder={i18next.t("Description...")}
            onChange={(e) => setTokenDescription(e.target.value)}
            //value={tokenDescription}
          />
        </Modal>
      ) : null}
    </>
  );
}
