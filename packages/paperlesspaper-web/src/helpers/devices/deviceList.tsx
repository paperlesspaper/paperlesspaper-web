import EinkDisplay from "./eink-display.png";
import { deviceList } from "@paperlesspaper/helpers";

const deviceListWithImage = [
  {
    id: "epaper",
    image: EinkDisplay,
  },
  {
    id: "epd7",
    image: EinkDisplay,
  },
]; /*as const*/

const combinedArray = [...deviceList, ...deviceListWithImage].reduce(
  (acc, curr) => {
    const existing = acc.find((item) => item.id === curr.id);
    if (existing) {
      Object.assign(existing, curr);
    } else {
      acc.push(curr);
    }
    return acc;
  },
  [],
);

export default combinedArray;

export function deviceByKind(device): any {
  const result = deviceList.find((e) => e.id === device);
  return result;
}

export function deviceByDeviceName(deviceName): any {
  if (!deviceName) return false;
  const result = deviceList.find((e) => {
    if (!e.deviceNameDetection) return false;

    return deviceName.startsWith(e.deviceNameDetection);
  });
  if (!result) return false;
  return result;
}

/**
 * Returns true if the device kind has the given feature
 */
export function deviceKindHasFeature(
  feature:
    | "ai"
    | "analog"
    | "epaper"
    | "no-user"
    | "wifi"
    | "nbiot"
    | "nouser"
    | "code"
    | "sensor"
    | "payment"
    | "anabox-smart"
    | "battery-offline"
    | "1intakes"
    | "3intakes"
    | "4intakes"
    | "5intakes"
    | "7intakes"
    | "day-colors"
    | "tray-colors"
    | "nuechtern-bedarf"
    | "stationaer"
    | "alt-device"
    | "battery-level",
  kind?: (typeof deviceList)[number]["id"],
  deviceAlt?: string,
): boolean {
  if (!kind) return false;

  const result: any = deviceList.find((e) => e.id === kind);

  if (deviceAlt && deviceAlt !== "main") {
    const alt = result?.alt?.find((a) => a.id === deviceAlt);
    if (alt?.features) return alt?.features?.includes(feature);
  }

  return result?.features?.includes(feature);
}
