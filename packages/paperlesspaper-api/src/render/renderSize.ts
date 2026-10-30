import { deviceByKind } from "@paperlesspaper/helpers";
import type { DeviceSize, Orientation } from "./render.types";
const OPENPAPER7_FALLBACK_SIZE = { width: 800, height: 480 };
export const resolveDeviceResolution = (
  kind?: string
): { width: number; height: number } => {
  const requested = kind ? deviceByKind(kind) : null;
  const fallback = deviceByKind("epd7");

  const width =
    requested?.resolution?.width ||
    fallback?.resolution?.width ||
    OPENPAPER7_FALLBACK_SIZE.width;
  const height =
    requested?.resolution?.height ||
    fallback?.resolution?.height ||
    OPENPAPER7_FALLBACK_SIZE.height;

  return { width, height };
};

export const getDeviceSize = ({
  kind,
  orientation = "portrait",
}: {
  kind: string;
  orientation?: Orientation;
}): DeviceSize => {
  const { width: initWidth, height: initHeight } =
    resolveDeviceResolution(kind);

  const rotationList: Record<Orientation, DeviceSize> = {
    portrait: {
      name: "portrait",
      width: initHeight,
      height: initWidth,
      frameKind: kind,
    },
    landscape: {
      name: "landscape",
      width: initWidth,
      height: initHeight,
      frameKind: kind,
    },
  };

  return rotationList[orientation];
};
