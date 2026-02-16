import { faCopy } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, TextInput, Tooltip } from "@progressiveui/react";
import type { ComponentProps } from "react";
import classNames from "classnames";

// derive the TextInput’s prop types directly from the component
type TextInputProps = ComponentProps<typeof TextInput>;

import React from "react";
import styles from "./inviteLink.module.scss";

interface TextInputWithCopyProps extends TextInputProps {
  value: string | number;
  tooltipContent?: (copied: boolean) => React.ReactNode;
  copyButtonText?: React.ReactNode;
}

export default function TextInputWithCopy({
  tooltipContent = () => "copy",
  copyButtonText,
  value,
  className,
  ...props
}: TextInputWithCopyProps) {
  const [copied, setCopied] = React.useState(false);

  const combinedClasses = classNames(styles.input, className);

  return (
    <div>
      <TextInput
        value={value}
        className={combinedClasses}
        {...props}
        readOnly
        addonAfter={
          <Tooltip content={tooltipContent(copied)}>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(String(value));
                setCopied(true);
              }}
              icon={<FontAwesomeIcon icon={faCopy} />}
            >
              {copyButtonText}
            </Button>
          </Tooltip>
        }
      />
    </div>
  );
}
