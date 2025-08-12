import { deviceByKind } from "helpers/devices/deviceList";
import { useActiveUserDevice } from "helpers/useUsers";

export interface Rotation {
  name: string;
  value: number;
  width: number;
  height: number;
}

export default function useRotationList(): Record<string, Rotation> {
  const activeDevice = useActiveUserDevice();

  const deviceMeta = deviceByKind(activeDevice.data?.kind);

  const initWidth = deviceMeta?.resolution?.width || 600;
  const initHeight = deviceMeta?.resolution?.height || 448;

  return {
    portrait: {
      name: "portrait",
      value: 9,
      width: initHeight,
      height: initWidth,
    },
    landscape: {
      name: "landscape",
      value: 0,
      width: initWidth,
      height: initHeight,
    },
  };
}
