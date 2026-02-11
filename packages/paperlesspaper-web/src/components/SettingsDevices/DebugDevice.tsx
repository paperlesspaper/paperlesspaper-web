import { BlockNotification } from "@progressiveui/react";
import React from "react";

import DeviceStatus from "./Debug/DeviceStatus";
import { Trans } from "react-i18next";
import { deviceKindHasFeature } from "helpers/devices/deviceList";
import { devicesApi } from "ducks/devices";

export default function DebugDevice({ id }: any) {
  const { data } = devicesApi.useGetSingleDevicesQuery(id, {
    skip: id === undefined,
  });

  return (
    <>
      <br />
      <BlockNotification
        kind="warning"
        title={<Trans>Debug section</Trans>}
        subtitle={
          <Trans>
            Use the debug section to enable new features and test the system.
          </Trans>
        }
      />

      {deviceKindHasFeature("epaper", data?.kind) && (
        <>
          <DeviceStatus id={id} />
        </>
      )}
    </>
  );
}
