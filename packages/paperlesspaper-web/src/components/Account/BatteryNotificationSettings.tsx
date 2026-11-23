import React, { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Input } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import { useWatch, type UseFormReturn } from "react-hook-form";
import checkboxStyles from "./batteryNotificationSettings.module.scss";
import { usePushContext } from "helpers/notifications/PushContext";

type Warning = "low" | "empty";
type Channel = "email" | "push";
type Preference = Record<Warning, Record<Channel, boolean>>;
const defaultPreference: Preference = {
  low: { email: false, push: false },
  empty: { email: false, push: false },
};

export default function BatteryNotificationSettings({
  form,
  query,
  accountLoaded,
}: {
  form: UseFormReturn<any>;
  query: {
    data?: Preference;
    isSuccess?: boolean;
    isLoading?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    refetch: () => unknown;
  };
  accountLoaded: boolean;
}) {
  const push = usePushContext();
  const { t } = useTranslation();
  const [activating, setActivating] = useState(false);
  const activationPending = useRef(false);
  const [pushError, setPushError] = useState(false);
  const { register, setValue, resetField, getFieldState, control, formState } =
    form;
  const value: Preference =
    useWatch({ control, name: "batteryNotifications" }) || defaultPreference;
  const disabled =
    !query.isSuccess ||
    query.isFetching ||
    formState.isSubmitting ||
    activating;

  useEffect(() => {
    if (!query.isSuccess || !query.data) return;
    for (const warning of ["low", "empty"] as const) {
      for (const channel of ["email", "push"] as const) {
        const name = `batteryNotifications.${warning}.${channel}`;
        if (!getFieldState(name).isDirty) {
          resetField(name, { defaultValue: query.data[warning][channel] });
        }
      }
    }
  }, [query.data, query.isSuccess, accountLoaded, getFieldState, resetField]);

  const enablePush = async () => {
    if (push.enabled) return true;
    activationPending.current = true;
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
      activationPending.current = false;
      setActivating(false);
    }
  };
  const change = async (
    warning: Warning,
    channel: Channel,
    checked: boolean
  ) => {
    if (channel === "push") {
      setPushError(false);
      if (checked && !(await enablePush())) return;
    }
    setValue(`batteryNotifications.${warning}.${channel}`, checked, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <section aria-labelledby="notification-settings-heading">
      <h3 id="notification-settings-heading">
        <Trans>Notifications</Trans>
      </h3>
      {(["low", "empty"] as const).map((warning) => (
        <Input
          key={warning}
          className={checkboxStyles.warning}
          labelText={
            <span id={`battery-notification-${warning}-label`}>
              {warning === "low" ? (
                <Trans>Battery running low</Trans>
              ) : (
                <Trans>Battery empty</Trans>
              )}
            </span>
          }
          helperText={
            <span id={`battery-notification-${warning}-description`}>
              {warning === "low" ? (
                <Trans>Below 15% battery level.</Trans>
              ) : (
                <Trans>No contact from the device for more than one day.</Trans>
              )}
            </span>
          }
        >
          <div
            className={checkboxStyles.channels}
            role="group"
            aria-labelledby={`battery-notification-${warning}-label`}
            aria-describedby={`battery-notification-${warning}-description`}
          >
            <Checkbox
              wrapperClassName={checkboxStyles.choice}
              id={`battery-notification-${warning}-email`}
              labelText={<Trans>Email</Trans>}
              {...register(`batteryNotifications.${warning}.email`)}
              checked={value[warning]?.email ?? false}
              disabled={disabled}
              onChange={(event) =>
                change(warning, "email", event.target.checked)
              }
            />
            <Checkbox
              wrapperClassName={checkboxStyles.choice}
              id={`battery-notification-${warning}-push`}
              labelText={<Trans>Push notifications</Trans>}
              {...register(`batteryNotifications.${warning}.push`, {
                validate: () =>
                  !activationPending.current || t("Enabling push notifications…"),
              })}
              checked={value[warning]?.push ?? false}
              disabled={
                disabled ||
                push.busy ||
                (!push.supported && !value[warning]?.push)
              }
              onChange={(event) =>
                change(warning, "push", event.target.checked)
              }
            />
          </div>
        </Input>
      ))}
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
    </section>
  );
}
