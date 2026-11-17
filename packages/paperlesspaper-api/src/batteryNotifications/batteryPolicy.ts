import { normalizeTimestamp } from "../utils/normalizeTimestamp.js";
import type { BatteryWarning } from "./batteryPreference.js";

export const supportsBatteryWarning = (kind: string) =>
  kind === "epd7" || kind === "openpaper13";

export const getBatteryWarning = (
  kind: string,
  status: any,
  now = Date.now()
): BatteryWarning | null => {
  if (!supportsBatteryWarning(kind) || !status) return null;
  const last = normalizeTimestamp(status.lastReachableAgo);
  if (last === null || last <= 0 || last > now) return null;
  // This is a no-contact warning, not a measured state of charge. Old USB and
  // battery readings or a planned sleep must not suppress the requested rule.
  if (now - last > 24 * 60 * 60_000) return "empty";

  const voltage = Number(status.batLevel);
  if (!Number.isFinite(voltage) || voltage <= 0) return null;
  // Same clamped 4200–6000 mV estimate as the web indicator: strictly below 15%.
  const percent = Math.max(0, Math.min(100, ((voltage - 4200) / 1800) * 100));
  if (
    percent >= 15 ||
    status.usbConnected === true ||
    status.chargerState === "charging"
  )
    return null;
  const next = normalizeTimestamp(status.nextDeviceSync);
  const interval = Number(status.sleepTime) * 1000;
  const hasInterval = Number.isFinite(interval) && interval > 0;
  const expected =
    next !== null && next > last ? next : hasInterval ? last + interval : null;
  const expires =
    expected === null
      ? last + 48 * 60 * 60_000
      : expected + Math.max(15 * 60_000, hasInterval ? interval : 0);
  return now <= expires ? "low" : null;
};
