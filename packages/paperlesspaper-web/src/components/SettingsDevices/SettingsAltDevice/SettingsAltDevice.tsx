import { InputGroup } from "@progressiveui/react";
import { deviceByKind } from "@paperlesspaper/helpers";

import { format } from "date-fns";
import React, { useEffect } from "react";
import MultiCheckbox from "components/MultiCheckbox";

export default function SettingsAltDevice({ entryData, register, form }: any) {
  const deviceMeta = deviceByKind(entryData?.kind);
  const deviceAlt = form.watch("meta.deviceAlt");
  const deviceMetaWithAlt =
    deviceAlt && deviceAlt !== "main"
      ? deviceMeta?.alt.find((a) => a.id === deviceAlt)
      : deviceMeta;

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
