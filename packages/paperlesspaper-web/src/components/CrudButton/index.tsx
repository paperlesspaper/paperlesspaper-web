import React from "react";
import { Button, InlineLoading } from "@progressiveui/react";

import styles from "./styles.module.scss";
import { Trans } from "react-i18next";

export default function CrudButton({
  loading,
  status,
  wrapper,
  ...other
}: any) {
  const buttonProps: any = {
    id: other.id,
    children: other.children,
    kind: other.kind,
    large: other.large,
    type: "submit",
    icon: other.icon,
    href: other.href,
    form: "settings-form",
    "data-testid": other["data-testid"],
  };
  if (wrapper === "inline") {
    return (
      <Button {...buttonProps}>
        {loading ? <Trans>Saving...</Trans> : other.children}
      </Button>
    );
  }

  if (wrapper === "link") {
    return (
      <div className={styles.wrapperClasses}>
        {loading || status ? (
          <InlineLoading
            className={styles.saving}
            /* description={
              loading ? <Trans>Saving...</Trans> : <Trans>Saved</Trans>
            } */
            success={status}
          />
        ) : (
          <button {...buttonProps} className={styles.linkButton} />
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapperClasses}>
      <Button {...buttonProps} />
      {(loading || status) && (
        <InlineLoading
          className={styles.saving}
          description={
            loading ? <Trans>Saving...</Trans> : <Trans>Saved</Trans>
          }
          success={status}
        />
      )}
    </div>
  );
}
