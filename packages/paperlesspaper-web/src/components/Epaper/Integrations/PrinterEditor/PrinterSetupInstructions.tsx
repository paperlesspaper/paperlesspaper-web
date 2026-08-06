import { faPlusCircle } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, InlineLoading, Story } from "@progressiveui/react";
import TextInputWithCopy from "components/inputs/TextInputWithCopy";
import React from "react";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import styles from "./styles.module.scss";
import usePrinterSetup, { PRINTER_IPPS_ADDRESS } from "./usePrinterSetup";

export default function PrinterSetupInstructions() {
  const {
    paperId,
    hasSavedPaper,
    hasGeneratedToken,
    generatedToken,
    createToken,
    createTokenResult,
    printerPath,
    macLinuxUrl,
    windowsUrl,
    windowsCommand,
    linuxCommand,
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
          id="printerTokenInstructions"
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
      <ul className={styles.steps}>
        <li>
          <Trans>Open PowerShell as administrator.</Trans>
        </li>
        <li>
          <Trans>Run the command below.</Trans>
        </li>
        <li>
          <Trans>
            Confirm that Windows uses the Microsoft IPP Class Driver.
          </Trans>
        </li>
      </ul>
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
      <ul className={styles.steps}>
        <li>
          <Trans>
            Open System Settings → Printers &amp; Scanners → Add Printer,
            Scanner, or Fax, then select the IP tab.
          </Trans>
        </li>
        <li>
          <Trans>
            Use AirPrint or Internet Printing Protocol and enter the address and
            queue shown below.
          </Trans>
        </li>
        <li>
          <Trans>Add the printer and select AirPrint when prompted.</Trans>
        </li>
      </ul>
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
      <div className={styles.manualFields}>
        <TextInputWithCopy
          labelText={<Trans>Address</Trans>}
          value={PRINTER_IPPS_ADDRESS}
          copyButtonText={<Trans>Copy</Trans>}
          className={styles.inputField}
        />
        <TextInputWithCopy
          labelText={<Trans>Queue</Trans>}
          value={printerPath}
          copyButtonText={<Trans>Copy</Trans>}
        />
      </div>
    </>
  );

  const linuxSetup = (
    <>
      <h3>
        <Trans>Linux</Trans>
      </h3>
      <ul className={styles.steps}>
        <li>
          <Trans>Install and start CUPS.</Trans>
        </li>
        <li>
          <Trans>Run the command below.</Trans>
        </li>
        <li>
          <Trans>
            Print a test file with: lp -d paperlesspaper document.pdf
          </Trans>
        </li>
      </ul>
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
    <Story>
      {tokenSetup}

      {hasSavedPaper && (
        <>
          {windowsSetup}
          {macSetup}
          {linuxSetup}

          <Callout
            kind="info"
            title={<Trans>Refresh printer capabilities</Trans>}
          >
            <Trans>
              If paper sizes are missing or outdated, remove the printer and add
              it again. Windows, macOS, and CUPS cache printer capabilities.
            </Trans>
          </Callout>

          <p>
            <Trans>
              After installation, choose OpenPaper 7 or Open Paper L in the
              print dialog. Both sizes also provide a borderless option.
            </Trans>
          </p>
        </>
      )}
    </Story>
  );
}
