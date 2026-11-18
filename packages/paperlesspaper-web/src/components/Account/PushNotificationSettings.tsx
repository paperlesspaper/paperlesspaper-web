import React from "react";
import { Button, InputGroup } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { usePushContext } from "helpers/notifications/PushContext";
import styles from "./pushNotificationSettings.module.scss";

export default function PushNotificationSettings() {
  const {
    optedIn,
    busy,
    supported,
    error,
    enableNotifications,
    disableNotifications,
  } = usePushContext();
  return (
    <InputGroup
      labelText={<Trans>Push notifications</Trans>}
      helperText={<Trans>On this device, via Google Firebase.</Trans>}
    >
      {(!supported || busy) && (
        <p className={styles.status} role="status" aria-live="polite">
          {!supported ? (
            <Trans>
              Push notifications are not supported on this device or browser.
            </Trans>
          ) : (
            <Trans>Updating notification settings…</Trans>
          )}
        </p>
      )}
      {error && (
        <p role="alert">
          {error === "permission" ? (
            <Trans>
              Notifications were not allowed. You can change the permission in
              your browser or device settings.
            </Trans>
          ) : error === "cleanup" ? (
            <Trans>
              Notifications could not be fully disabled. Please retry when you
              are online.
            </Trans>
          ) : (
            <Trans>Notifications could not be enabled. Please try again.</Trans>
          )}
        </p>
      )}
      {(supported || error === "cleanup") && (
        <Button
          className={styles.button}
          type="button"
          kind="tertiary"
          disabled={busy}
          onClick={
            optedIn || error === "cleanup"
              ? disableNotifications
              : enableNotifications
          }
        >
          {error === "cleanup" ? (
            <Trans>Retry disabling notifications</Trans>
          ) : optedIn ? (
            <Trans>Disable</Trans>
          ) : (
            <Trans>Enable</Trans>
          )}
        </Button>
      )}
    </InputGroup>
  );
}
