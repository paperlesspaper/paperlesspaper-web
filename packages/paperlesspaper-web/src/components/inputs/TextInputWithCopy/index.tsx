import { faCopy } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, TextInput, Tooltip } from "@progressiveui/react";
import type { ComponentProps } from "react";
import classNames from "classnames";

// derive the TextInput’s prop types directly from the component
type TextInputProps = ComponentProps<typeof TextInput>;

import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./inviteLink.module.scss";

interface TextInputWithCopyProps extends TextInputProps {
  value: string | number;
  tooltipContent?: (copied: boolean) => React.ReactNode;
  copyButtonText?: React.ReactNode;
}

export default function TextInputWithCopy({
  tooltipContent,
  copyButtonText,
  value,
  className,
  id,
  name,
  ...props
}: TextInputWithCopyProps) {
  const [copied, setCopied] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const copyRequest = React.useRef(0);
  const { t } = useTranslation();
  const generatedId = React.useId();
  const inputId = id || name || generatedId;

  const combinedClasses = classNames(styles.input, className);

  React.useEffect(() => {
    setCopied(false);
    setCopying(false);
    setCopyFailed(false);
    return () => { copyRequest.current += 1; };
  }, [value]);

  const copy = async () => {
    const request = ++copyRequest.current;
    setCopied(false);
    setCopyFailed(false);
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(String(value));
      if (request === copyRequest.current) setCopied(true);
    } catch {
      if (request !== copyRequest.current) return;
      setCopyFailed(true);
      const input = document.getElementById(inputId);
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    } finally {
      if (request === copyRequest.current) setCopying(false);
    }
  };

  return (
    <div>
      <TextInput
        id={inputId}
        name={name}
        value={value}
        className={combinedClasses}
        {...props}
        readOnly
        addonAfter={
          <Tooltip content={tooltipContent ? tooltipContent(copied) : t(copied ? "Copied" : "Copy")}>
            <Button
              type="button"
              aria-label={t("Copy")}
              disabled={copying}
              onClick={copy}
              icon={<FontAwesomeIcon icon={faCopy} />}
            >
              {copyButtonText}
            </Button>
          </Tooltip>
        }
      />
      {copyFailed && (
        <p role="alert">
          {t("Copying failed. Select the text and copy it manually (⌘C on Mac, Ctrl+C on Windows).")}
        </p>
      )}
    </div>
  );
}
