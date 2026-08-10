import { faClock } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import TimezoneSelect from "components/inputs/TimezoneSelect";
import React from "react";
import { Trans } from "react-i18next";
import { Controller } from "react-hook-form";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import useEditor from "../Integrations/ImageEditor/useEditor";

const ModalComponent = () => {
  const { form }: any = useEditor();

  return (
    <Controller
      control={form.control}
      name="meta.timezone"
      render={({ field }) => (
        <TimezoneSelect
          value={field.value}
          onChange={(selected: { utc?: string[] } | null) => {
            const selectedTimezones = selected?.utc || [];
            const timezone = selectedTimezones.includes(field.value)
              ? field.value
              : selectedTimezones[0];

            field.onChange(timezone);
          }}
          labelText={<Trans>Timezone</Trans>}
          helperText={
            <Trans>Select the timezone where the device is in use</Trans>
          }
        />
      )}
    />
  );
};

export default function TimezoneField() {
  return (
    <EditorButton
      id="timezone"
      kind="secondary"
      text={<Trans>Timezone</Trans>}
      icon={<FontAwesomeIcon icon={faClock} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Timezone</Trans>}
    />
  );
}
