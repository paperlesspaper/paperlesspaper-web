import React, { useState } from "react";
import { TextInput } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/pro-regular-svg-icons";
import { useTranslation } from "react-i18next";
import styles from "./accountSecurity.module.scss";

export default function SecurityPasswordInput(
  props: React.ComponentProps<typeof TextInput>
) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      {...props}
      type={visible ? "text" : "password"}
      addonAfter={
        <button
          type="button"
          className={styles.passwordToggle}
          disabled={props.disabled}
          aria-label={t(visible ? "Hide password" : "Show password")}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
        </button>
      }
    />
  );
}
