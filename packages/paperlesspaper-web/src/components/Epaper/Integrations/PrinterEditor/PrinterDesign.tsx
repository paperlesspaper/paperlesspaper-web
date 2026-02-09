import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, InlineLoading, Story } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./printerDesign.module.scss";
import { Link } from "react-router-dom";
import { faPlusCircle } from "@fortawesome/pro-solid-svg-icons";

import TextInputWithCopy from "components/inputs/TextInputWithCopy";
import { tokensApi } from "ducks/tokens";

const PrinterContent = () => {
  const store: any = useEditor();

  const [createToken, createTokenResult] =
    tokensApi.useCreateSingleTokensMutation();

  const paperId = store?.entryData?.id;

  const hasSavedPaper = Boolean(paperId) && store?.params?.paper !== "new";

  // Minimal: show a ready-to-copy template URL.
  // Host and token depend on the user's environment, so we keep placeholders.
  const generatedToken = createTokenResult.data?.raw;
  const hasGeneratedToken = Boolean(
    createTokenResult.isSuccess && generatedToken,
  );

  const ippUrl = hasSavedPaper
    ? `ipps://paperlessprinter.fly.dev/ipp/print/${paperId}/${encodeURIComponent(
        generatedToken || "your_api_key",
      )}`
    : "";

  const ippAddress = `paperlessprinter.fly.dev`;
  const ippQueue = `ipp/print/${paperId}/${encodeURIComponent(
    generatedToken || "your_api_key",
  )}`;

  const ippUrlTemplate =
    " ipps://paperlessprinter.fly.dev/ipp/print/<paper_id>/your_api_key";

  return (
    <Story>
      <p>
        <Trans>
          You can use your paperlesspaper as a network printer. This way you can
          use it like any other printer. Follow the steps below to set it up on
          your computer.
        </Trans>
      </p>

      {hasSavedPaper && (
        <>
          {hasGeneratedToken ? (
            <>
              <Callout
                kind="success"
                title={<Trans>Your API key is ready</Trans>}
              >
                <Trans>
                  Copy and store this API key securely now. For security
                  reasons, you may not be able to view it again. You can manage
                  keys in your <Link to="/account">account settings</Link>.
                </Trans>
              </Callout>

              <div style={{ marginTop: 12 }}>
                <TextInputWithCopy
                  id="printerToken"
                  labelText={<Trans>API key</Trans>}
                  readOnly
                  value={generatedToken}
                  copyButtonText={<Trans>Copy</Trans>}
                  tooltipContent={(copied) =>
                    copied ? (
                      <Trans>API key copied</Trans>
                    ) : (
                      <Trans>Click to copy API key…</Trans>
                    )
                  }
                />
              </div>
            </>
          ) : (
            <Callout
              kind="info"
              title={<Trans>Create an API key</Trans>}
              actions={
                <Button
                  kind="secondary"
                  disabled={!hasSavedPaper || createTokenResult.isLoading}
                  onClick={async () => {
                    createTokenResult.reset?.();
                    await createToken({
                      values: {
                        name: paperId ? `Printer (${paperId})` : "Printer",
                      },
                    });
                  }}
                >
                  {createTokenResult.isLoading ? (
                    <InlineLoading />
                  ) : (
                    <Trans>Generate Token</Trans>
                  )}
                </Button>
              }
            >
              <span>
                <Trans>
                  To use the printer integration, generate an API key in your{" "}
                  <Link to="/account">account settings</Link> or generate one
                  here. Do not share this token with anyone.
                </Trans>
              </span>
            </Callout>
          )}

          <TextInputWithCopy
            labelText={<Trans>Printer URL</Trans>}
            readOnly
            value={ippUrl}
            placeholder={ippUrlTemplate}
            onFocus={(e: any) => e?.target?.select?.()}
          />

          {hasSavedPaper && hasGeneratedToken && (
            <Button
              href={ippUrl}
              className={styles.addButton}
              icon={<FontAwesomeIcon icon={faPlusCircle} />}
            >
              <Trans>Add printer to your computer</Trans>
            </Button>
          )}

          <h3>
            <Trans>Add the printer on macOS manually</Trans>
          </h3>
          <p>
            <Trans>
              You can also add the printer manually on macOS. Therefore, follow
              these steps:
            </Trans>
          </p>
          <p className={styles.instructions}>
            <Trans>
              <strong>System Settings</strong> →{" "}
              <strong>Printers & Scanners</strong>→{" "}
              <strong>Add Printer…</strong> → <strong>IP address / URL</strong>
            </Trans>
          </p>
          <p>
            <Trans>Enter the following details:</Trans>
          </p>
          <p className={styles.instructions}>
            <TextInputWithCopy
              labelText={<Trans>Address</Trans>}
              value={ippAddress}
              readOnly
              className={styles.inputField}
            />

            <TextInputWithCopy
              labelText={<Trans>Waitlist</Trans>}
              value={ippQueue}
              readOnly
            />
          </p>
        </>
      )}
    </Story>
  );
};

export default function PrinterDesign() {
  return (
    <EditorButton
      id="settings"
      kind="secondary"
      text={<Trans>Instructions</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={PrinterContent}
    />
  );
}
