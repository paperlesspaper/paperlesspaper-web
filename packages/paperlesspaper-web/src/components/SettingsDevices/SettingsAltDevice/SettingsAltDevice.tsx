import { InputGroup } from "@progressiveui/react";
import { deviceByKind } from "@paperlesspaper/helpers";

import React from "react";
import MultiCheckbox from "components/MultiCheckbox";

export default function SettingsAltDevice({ entryData, register, form }: any) {
  const deviceMeta = deviceByKind(entryData?.kind);
  form.watch("meta.deviceAlt");

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
