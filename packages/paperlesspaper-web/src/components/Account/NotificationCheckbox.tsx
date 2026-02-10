import { Checkbox, Input } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";
import styles from "./checkboxWrapper.module.scss";

export default function NotificationCheckbox({
  description,
  labelText,
  register,
  name,
}: any) {
  return (
    <Input labelText={labelText} helperText={description}>
      <div className={styles.checkboxWrapper}>
        {/*<MultiCheckbox
          labelText={<Trans>{labelText}</Trans>}
          description={<Trans>{description}</Trans>}
          id="gender-off"
          type="checkbox"
          mobile="vertical"
          kind="vertical"
          {...register("notificationsIntakeLate")}
  />*/}
        <Checkbox
          labelText={<Trans>Email</Trans>}
          id={`notification.${name}-email`}
          name={`notification.${name}-email`}
          {...register(`notification.${name}.email`)}
        />
        <Checkbox
          labelText={<Trans>Push Notification</Trans>}
          id={`notification.${name}-push`}
          name={`notification.${name}-push`}
          {...register(`notification.${name}.push`)}
        />
      </div>
    </Input>
  );
}
