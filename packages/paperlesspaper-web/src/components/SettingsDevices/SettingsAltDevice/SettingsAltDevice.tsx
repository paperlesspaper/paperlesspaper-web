import { InputGroup } from "@progressiveui/react";
import { deviceByKind } from "@wirewire/helpers";
import { getWeekDays } from "components/pillDispenser/CalendarForm/getWeekDays";

import { format } from "date-fns";
import React, { useEffect } from "react";
import MultiCheckbox from "components/MultiCheckbox";

export default function SettingsAltDevice({ entryData, register, form }: any) {
  const weekdays = getWeekDays();
  const deviceMeta = deviceByKind(entryData?.kind);
  const deviceAlt = form.watch("meta.deviceAlt");
  const deviceMetaWithAlt =
    deviceAlt && deviceAlt !== "main"
      ? deviceMeta?.alt.find((a) => a.id === deviceAlt)
      : deviceMeta;

  useEffect(() => {
    if (deviceAlt) {
      weekdays.map((dayTime) => {
        if (deviceMetaWithAlt?.colors?.[format(dayTime, "EEEE").toLowerCase()])
          form.setValue(
            `meta.colors.dayTime-${format(dayTime, "EEEE").toLowerCase()}`,
            deviceMetaWithAlt?.colors?.[format(dayTime, "EEEE").toLowerCase()]
          );
      });
    }
    if (!deviceAlt) {
      form.setValue("meta.deviceAlt", "main");
    }
  }, [deviceAlt]);

  return (
    <>
      <InputGroup
        labelText={<>Gerät</>}
        helperText={`Wählen Sie aus, welches Gerät Sie haben`}
      >
        <MultiCheckbox
          labelText={deviceMeta?.name}
          value={"main"}
          type="radio"
          {...register("meta.deviceAlt")}
        />

        {deviceMeta?.alt.map &&
          deviceMeta?.alt.map((d, i) => (
            <MultiCheckbox
              key={i}
              labelText={d?.name}
              value={d?.id}
              type="radio"
              {...register("meta.deviceAlt")}
            />
          ))}
      </InputGroup>
    </>
  );
}
