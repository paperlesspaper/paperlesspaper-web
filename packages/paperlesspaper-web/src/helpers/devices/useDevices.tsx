import { useParams } from "react-router-dom";
import { devicesApi } from "ducks/devices";

export function useActiveDevice(activeDeviceId?: string) {
  const { kind, entry } = useParams();
  //if (!device) return null;
  const activeDevice = activeDeviceId
    ? activeDeviceId
    : entry && kind === "device"
      ? entry
      : undefined;

  const data = devicesApi.useGetSingleDevicesQuery(activeDevice, {
    skip: activeDevice === undefined,
  });

  return data;
}
