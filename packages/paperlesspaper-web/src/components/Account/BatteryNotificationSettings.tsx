import React, { useState } from "react";
import { Button, Checkbox, InputGroup } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { accountsApi } from "ducks/accounts";
import styles from "./pushNotificationSettings.module.scss";
import checkboxStyles from "./batteryNotificationSettings.module.scss";
import { usePushContext } from "helpers/notifications/PushContext";

type Preference = { email: boolean; push: boolean };

export default function BatteryNotificationSettings() {
  const push = usePushContext();
  const [activating, setActivating] = useState(false);
  const [pushError, setPushError] = useState(false);
  const query = accountsApi.useGetBatteryNotificationPreferenceQuery();
  const [update, mutation] =
    accountsApi.useUpdateBatteryNotificationPreferenceMutation();
  const [draft, setDraft] = useState<Preference | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft || query.data || { email: false, push: false };
  const disabled =
    !query.isSuccess || query.isFetching || mutation.isLoading || activating;
  const enablePush = async () => {
    if (push.enabled) return true;
    setActivating(true);
    setPushError(false);
    try {
      const enabled = await push.enableNotifications();
      setPushError(!enabled);
      return enabled;
    } catch {
      setPushError(true);
      return false;
    } finally {
      setActivating(false);
    }
  };
  const change = async (channel: keyof Preference, checked: boolean) => {
    setSaved(false);
    if (channel === "push") {
      setPushError(false);
      if (checked && !(await enablePush())) return;
    }
    setDraft({ ...value, [channel]: checked });
  };
  const save = async () => {
    setSaved(false);
    try {
      if (value.push && !(await enablePush())) return;
      const result = await update(value).unwrap();
      setDraft(result);
      setSaved(true);
    } catch {
      /* The mutation error is displayed below; preserve the draft. */
    }
  };

  return (
    <InputGroup
      labelText={<Trans>Low battery notifications</Trans>}
      helperText={
        <Trans>
          Get notified when your device's batteries are running low. Checked
          every four hours; reminders at most every 48 hours.
        </Trans>
      }
    >
      <Checkbox
        wrapperClassName={checkboxStyles.choice}
        id="battery-notification-email"
        labelText={<Trans>Email</Trans>}
        checked={value.email}
        disabled={disabled}
        onChange={(event) => change("email", event.target.checked)}
      />
      <Checkbox
        wrapperClassName={checkboxStyles.choice}
        id="battery-notification-push"
        labelText={<Trans>Push notifications</Trans>}
        checked={value.push}
        disabled={disabled || push.busy || (!push.supported && !value.push)}
        onChange={(event) => change("push", event.target.checked)}
      />
      <p className={styles.status}>
        <Trans>
          Enabling push alerts also enables notifications on this device.
        </Trans>
      </p>
      {activating && (
        <p role="status">
          <Trans>Enabling push notifications…</Trans>
        </p>
      )}
      {(pushError || !push.supported) && (
        <p role="alert">
          <Trans>
            Push notifications could not be enabled on this device. Check your
            notification permissions and try again.
          </Trans>
        </p>
      )}
      {query.isLoading && (
        <p role="status">
          <Trans>Loading notification settings…</Trans>
        </p>
      )}
      {query.isError && (
        <p role="alert">
          <Trans>Notification settings could not be loaded.</Trans>{" "}
          <Button
            type="button"
            kind="secondary"
            onClick={() => query.refetch()}
          >
            <Trans>Retry</Trans>
          </Button>
        </p>
      )}
      {mutation.isError && (
        <p role="alert">
          <Trans>
            Notification settings could not be saved. Please try again.
          </Trans>
        </p>
      )}
      {saved && (
        <p role="status">
          <Trans>Notification settings saved.</Trans>
        </p>
      )}
      <Button
        type="button"
        kind="secondary"
        className={`${styles.button} ${checkboxStyles.saveButton}`}
        disabled={disabled}
        onClick={save}
      >
        {mutation.isLoading ? (
          <Trans>Saving…</Trans>
        ) : (
          <Trans>Save notification settings</Trans>
        )}
      </Button>
    </InputGroup>
  );
}
