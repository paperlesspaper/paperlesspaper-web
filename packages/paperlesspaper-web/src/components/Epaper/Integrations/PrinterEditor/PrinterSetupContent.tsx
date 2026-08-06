import { faPlusCircle } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, InlineLoading, Story } from "@progressiveui/react";
import TextInputWithCopy from "components/inputs/TextInputWithCopy";
import React from "react";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import styles from "./styles.module.scss";
import usePrinterSetup from "./usePrinterSetup";

export default function PrinterSetupContent() {
  const {
    paperId,
    hasSavedPaper,
    hasGeneratedToken,
    generatedToken,
    createToken,
    createTokenResult,
    macLinuxUrl,
    windowsUrl,
    windowsCommand,
    linuxCommand,
    platform,
  } = usePrinterSetup();

  const tokenSetup = !hasSavedPaper ? (
    <Callout kind="warning" title={<Trans>Save this Paper first</Trans>}>
      <Trans>Save this Paper before setting up the printer.</Trans>
    </Callout>
  ) : hasGeneratedToken ? (
    <>
      <Callout kind="success" title={<Trans>Your API key is ready</Trans>}>
        <Trans>
          Copy and store this API key securely now. For security reasons, you
          may not be able to view it again. You can manage keys in your{" "}
          <Link to="/account">account settings</Link>.
        </Trans>
      </Callout>

      <div className={styles.tokenField}>
        <TextInputWithCopy
          id="printerTokenQuick"
          labelText={<Trans>API key</Trans>}
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
          disabled={createTokenResult.isLoading}
          onClick={async () => {
            createTokenResult.reset?.();
            await createToken({
              values: {
                name: `Printer (${paperId})`,
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
          <Link to="/account">account settings</Link> or generate one here. Do
          not share this token with anyone.
        </Trans>
      </span>
    </Callout>
  );

  const windowsSetup = (
    <>
      <h3>
        <Trans>Windows</Trans>
      </h3>
      <TextInputWithCopy
        labelText={<Trans>Windows printer URL (HTTPS)</Trans>}
        value={windowsUrl}
        copyButtonText={<Trans>Copy</Trans>}
        className={styles.inputField}
      />
      <TextInputWithCopy
        labelText={<Trans>PowerShell command</Trans>}
        value={windowsCommand}
        copyButtonText={<Trans>Copy</Trans>}
      />
      <p className={styles.platformNote}>
        <Trans>
          Windows must use the HTTPS URL. Do not replace it with ipps://.
        </Trans>
      </p>
    </>
  );

  const macSetup = (
    <>
      <h3>
        <Trans>macOS</Trans>
      </h3>
      <TextInputWithCopy
        labelText={<Trans>macOS printer URL (IPPS)</Trans>}
        value={macLinuxUrl}
        copyButtonText={<Trans>Copy</Trans>}
      />
      {hasGeneratedToken && (
        <Button
          href={macLinuxUrl}
          className={styles.addButton}
          icon={<FontAwesomeIcon icon={faPlusCircle} />}
        >
          <Trans>Add printer on macOS</Trans>
        </Button>
      )}
    </>
  );

  const linuxSetup = (
    <>
      <h3>
        <Trans>Linux</Trans>
      </h3>
      <TextInputWithCopy
        labelText={<Trans>Linux printer URL (IPPS)</Trans>}
        value={macLinuxUrl}
        copyButtonText={<Trans>Copy</Trans>}
        className={styles.inputField}
      />
      <TextInputWithCopy
        labelText={<Trans>CUPS command</Trans>}
        value={linuxCommand}
        copyButtonText={<Trans>Copy</Trans>}
      />
    </>
  );

  return (
    <Story className={styles.quickSetup}>
      <p>
        <Trans>
          You can use your paperlesspaper as a network printer. This way you can
          use it like any other printer. Follow the steps below to set it up on
          your computer.
        </Trans>
      </p>
      {tokenSetup}
      {hasSavedPaper && (
        <>
          {platform === "windows" && windowsSetup}
          {platform === "macos" && macSetup}
          {platform === "linux" && linuxSetup}
          {platform === "unknown" && (
            <section className={styles.platformSection}>
              <Callout
                kind="warning"
                title={<Trans>Operating system not detected</Trans>}
              >
                <Trans>
                  Open Instructions and choose Windows, macOS, or Linux.
                </Trans>
              </Callout>
              <TextInputWithCopy
                labelText={<Trans>Windows printer URL (HTTPS)</Trans>}
                value={windowsUrl}
                copyButtonText={<Trans>Copy</Trans>}
                className={styles.inputField}
              />
              <TextInputWithCopy
                labelText={<Trans>macOS and Linux printer URL (IPPS)</Trans>}
                value={macLinuxUrl}
                copyButtonText={<Trans>Copy</Trans>}
              />
              {hasGeneratedToken && (
                <Button
                  href={macLinuxUrl}
                  className={styles.addButton}
                  icon={<FontAwesomeIcon icon={faPlusCircle} />}
                >
                  <Trans>Add printer on macOS</Trans>
                </Button>
              )}
            </section>
          )}
        </>
      )}
    </Story>
  );
}
