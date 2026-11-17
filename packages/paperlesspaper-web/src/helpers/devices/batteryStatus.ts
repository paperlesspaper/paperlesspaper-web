import { deviceByKind, deviceKindHasFeature } from "@paperlesspaper/helpers";

export interface BatteryTelemetry {
  batLevel?: number | string | null;
  usbConnected?: boolean | null;
  chargerState?: string;
  lastReachableAgo?: number | string | null;
  nextDeviceSync?: number | string | null;
  sleepTime?: number | string;
}

const timestamp = (value: BatteryTelemetry["lastReachableAgo"]) => {
  if (value == null || value === "") return NaN;
  const numeric = Number(value);
  const result = Number.isFinite(numeric)
    ? numeric < 1e12
      ? numeric * 1000
      : numeric
    : Date.parse(String(value));
  return result > 0 && Number.isFinite(new Date(result).getTime())
    ? result
    : NaN;
};

export const scaleBatteryRange = ({
  value,
  istart = 3300,
  istop = 3900,
  ostart = 0,
  ostop = 100,
}: {
  value?: number | string | null;
  istart?: number;
  istop?: number;
  ostart?: number;
  ostop?: number;
}) => {
  if (
    value == null ||
    String(value).trim() === "" ||
    !Number.isFinite(Number(value)) ||
    Number(value) <= 0 ||
    istop <= istart
  )
    return NaN;
  const fraction = Math.min(
    1,
    Math.max(0, (Number(value) - istart) / (istop - istart))
  );
  return ostart + (ostop - ostart) * fraction;
};

export const getBatteryStatus = ({
  currentDeviceClass,
  deviceStatus = {},
  now = Date.now(),
}: {
  currentDeviceClass?: string;
  deviceStatus?: BatteryTelemetry | null;
  now?: number;
}) => {
  deviceStatus ??= {};
  const deviceKind = deviceByKind(currentDeviceClass);
  // The EPD API reports the whole 4×AA pack in mV. Use the agreed Alkaline
  // estimate; battery chemistry is not reported, so this is not a NiMH SOC curve.
  // Firmware thresholds: warn below 4300 mV, stop battery handshakes below 4200 mV.
  const isEpdBattery =
    currentDeviceClass === "epd7" || currentDeviceClass === "openpaper13";
  const batteryRange = isEpdBattery
    ? { min: 4200, max: 6000 }
    : deviceKind?.battery;
  const levelScaled = scaleBatteryRange({
    value: deviceStatus.batLevel,
    istart: batteryRange?.min,
    istop: batteryRange?.max,
  });
  const lastReachableAt = timestamp(deviceStatus.lastReachableAgo);
  const nextSync = timestamp(deviceStatus.nextDeviceSync);
  const intervalMs = Number(deviceStatus.sleepTime) * 1000;
  const hasInterval = Number.isFinite(intervalMs) && intervalMs > 0;
  // Allow one missed wake-up (at least 15 minutes). Respect scheduled update windows.
  const expectedSync =
    nextSync > lastReachableAt
      ? nextSync
      : hasInterval
      ? lastReachableAt + intervalMs
      : NaN;
  const staleAfter = Number.isFinite(expectedSync)
    ? expectedSync + Math.max(15 * 60_000, hasInterval ? intervalMs : 0)
    : lastReachableAt + 48 * 60 * 60_000;
  const isStale = Number.isFinite(lastReachableAt) && now > staleAfter;
  const hasRecentContact = Number.isFinite(lastReachableAt) && !isStale;
  const isUsbConnected =
    hasRecentContact &&
    deviceKindHasFeature("epaper", currentDeviceClass) === true &&
    deviceStatus.usbConnected === true;
  const isCharging =
    hasRecentContact &&
    !isUsbConnected &&
    deviceStatus.chargerState === "charging";
  const batteryUnknown = !hasRecentContact || !Number.isFinite(levelScaled);
  const isBatteryLow =
    !batteryUnknown &&
    !isCharging &&
    !isUsbConnected &&
    (isEpdBattery ? Number(deviceStatus.batLevel) < 4300 : levelScaled < 30);
  const color = batteryUnknown
    ? undefined
    : isBatteryLow
    ? "red"
    : levelScaled >= 50
    ? "green"
    : "orange";
  return {
    levelScaled,
    color,
    batteryUnknown,
    isCharging,
    isUsbConnected,
    isStale,
    isBatteryLow,
    isEstimate: isEpdBattery,
    lastReachableAt,
  };
};
