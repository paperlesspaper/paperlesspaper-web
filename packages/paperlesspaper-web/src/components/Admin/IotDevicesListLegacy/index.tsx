import React from "react";
import { Item } from "@progressiveui/react";
import { iotDevicesApi } from "ducks/iotDevicesApi";
import { format } from "date-fns";
import JsonViewer from "components/JsonViewer";

export default function IotDevicesList() {
  const getAllDevicesQuery = iotDevicesApi.useGetAllIotdeviceQuery();

  const { data } = getAllDevicesQuery;

  if (!data) return <>Loading</>;
  return (
    <div>
      {data.length} devices
      {data.map((e, i) => (
        <Item
          key={i}
          title={e.deviceId}
          kind="horizontal"
          wrapper="repeater"
          hint={
            e.lastUpdateTime
              ? format(new Date(e.lastUpdateTime), "dd.MM.yyyy HH:mm")
              : null
          }
          /* subContent={
            <DeviceIdFormatted kind={e.kind}>{e.deviceId}</DeviceIdFormatted>
          } */
        >
          {e.batLevel}
          <JsonViewer src={e} collapsed />
        </Item>
      ))}
      <JsonViewer src={getAllDevicesQuery} collapsed />
    </div>
  );
}
