import { deviceByKind } from "helpers/devices/deviceList";
import { useActiveUserDevice } from "helpers/useUsers";

export interface Rotation {
  name: string;
  value: number;
  width: number;
  height: number;
}

export default function useRotationList(
  frameKind?: string,
): Record<string, Rotation> {
  const activeDevice = useActiveUserDevice();

  const targetKind = frameKind || activeDevice.data?.kind;
  const deviceMeta = deviceByKind(targetKind);

  const initWidth = deviceMeta?.resolution?.width || 1600;
  const initHeight = deviceMeta?.resolution?.height || 1200;

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
