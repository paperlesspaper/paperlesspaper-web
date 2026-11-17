import React, { useState } from "react";
import { Button, Checkbox, InputGroup } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { accountsApi } from "ducks/accounts";
import styles from "./pushNotificationSettings.module.scss";
import checkboxStyles from "./batteryNotificationSettings.module.scss";
import { usePushContext } from "helpers/notifications/PushContext";

type Warning = "low" | "empty";
type Channel = "email" | "push";
type Preference = Record<Warning, Record<Channel, boolean>>;
const defaultPreference: Preference = {
  low: { email: false, push: false },
  empty: { email: false, push: false },
};

export default function BatteryNotificationSettings() {
  const push = usePushContext();
  const [activating, setActivating] = useState(false);
  const [pushError, setPushError] = useState(false);
  const query = accountsApi.useGetBatteryNotificationPreferenceQuery();
  const [update, mutation] =
    accountsApi.useUpdateBatteryNotificationPreferenceMutation();
  const [draft, setDraft] = useState<Preference | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft || query.data || defaultPreference;
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
  const change = async (
    warning: Warning,
    channel: Channel,
    checked: boolean
  ) => {
    setSaved(false);
    if (channel === "push") {
      setPushError(false);
      if (checked && !(await enablePush())) return;
    }
    setDraft({
      ...value,
      [warning]: { ...value[warning], [channel]: checked },
    });
  };
  const save = async () => {
    setSaved(false);
    try {
      if ((value.low.push || value.empty.push) && !(await enablePush())) return;
      const result = await update(value).unwrap();
      setDraft(result);
      setSaved(true);
    } catch {
      /* The mutation error is displayed below; preserve the draft. */
    }
  };

  return (
    <InputGroup
      labelText={<Trans>Battery notifications</Trans>}
      helperText={
        <Trans>
          Checked every four hours. Each warning is repeated at most once every
          three weeks.
        </Trans>
      }
    >
      {(["low", "empty"] as const).map((warning) => (
        <fieldset key={warning} className={checkboxStyles.warning}>
          <legend>
            {warning === "low" ? (
              <Trans>Battery running low</Trans>
            ) : (
              <Trans>Battery empty</Trans>
            )}
          </legend>
          <p className={checkboxStyles.description}>
            {warning === "low" ? (
              <Trans>Below 15% battery level.</Trans>
            ) : (
              <Trans>No contact from the device for more than one day.</Trans>
            )}
          </p>
          <Checkbox
            wrapperClassName={checkboxStyles.choice}
            id={`battery-notification-${warning}-email`}
            labelText={<Trans>Email</Trans>}
            checked={value[warning].email}
            disabled={disabled}
            onChange={(event) => change(warning, "email", event.target.checked)}
          />
          <Checkbox
            wrapperClassName={checkboxStyles.choice}
            id={`battery-notification-${warning}-push`}
            labelText={<Trans>Push notifications</Trans>}
            checked={value[warning].push}
            disabled={
              disabled || push.busy || (!push.supported && !value[warning].push)
            }
            onChange={(event) => change(warning, "push", event.target.checked)}
          />
        </fieldset>
      ))}
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
