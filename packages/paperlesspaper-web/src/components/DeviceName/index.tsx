import { deviceByKind } from "@wirewire/helpers";
import UserName from "components/UserName";
import React from "react";

export default function DeviceName({ device, user }: any) {
  if (!device) return null;

  const deviceMeta = deviceByKind(device.kind);

  const name =
    device.meta?.deviceAlt && device.meta?.deviceAlt !== "main"
      ? deviceMeta?.alt.find((a) => a.id === device.meta.deviceAlt)?.name
      : deviceMeta?.name;
  return (
    <>
      {device.meta?.name ? (
        device.meta.name
      ) : device.patient ? (
        <>
          <UserName id={device.patient} user={user} /> {name}
        </>
      ) : (
        <>{name}</>
      )}
    </>
  );
}
