import React from "react";
import { Button } from "@progressiveui/react";
import styles from "./selectionActionSheet.module.scss";

export type SelectionActionSheetAction = {
  key: string;
  label: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  kind?: React.ComponentProps<typeof Button>["kind"];
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  ariaLabel?: string;
};

type SelectionActionSheetProps = {
  open: boolean;
  actions: SelectionActionSheetAction[];
  ariaLabel?: string;
};

export default function SelectionActionSheet({
  open,
  actions,
  ariaLabel = "Selection actions",
}: SelectionActionSheetProps) {
  if (!open) return null;

  return (
    <div className={styles.sheet} role="toolbar" aria-label={ariaLabel}>
      <div className={styles.actions}>
        {actions.map((action) => (
          <Button
            key={action.key}
            kind={action.kind}
            disabled={action.disabled}
            onClick={action.onClick}
            icon={action.icon}
            iconReverse={true}
            title={action.title}
            aria-label={action.ariaLabel}
            className={`${styles.action} ${
              action.danger ? styles.actionDanger : ""
            }`}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
