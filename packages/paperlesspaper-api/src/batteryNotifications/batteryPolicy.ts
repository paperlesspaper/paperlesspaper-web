import { normalizeTimestamp } from "../utils/normalizeTimestamp.js";

export const supportsBatteryWarning = (kind: string) =>
  kind === "epd7" || kind === "openpaper13";

// Keep aligned with the web battery indicator; a parity test covers both.
// Firmware warns below 4300 mV for the 4×AA pack, independently of the estimate.
export const needsBatteryWarning = (
  kind: string,
  status: any,
  now = Date.now()
) => {
  if (!supportsBatteryWarning(kind) || !status) return false;
  const voltage = Number(status.batLevel);
  if (!Number.isFinite(voltage) || voltage <= 0 || voltage >= 4300)
    return false;
  if (status.usbConnected === true || status.chargerState === "charging")
    return false;
  const last = normalizeTimestamp(status.lastReachableAgo);
  if (last === null || last <= 0) return false;
  const next = normalizeTimestamp(status.nextDeviceSync);
  const interval = Number(status.sleepTime) * 1000;
  const hasInterval = Number.isFinite(interval) && interval > 0;
  const expected =
    next !== null && next > last ? next : hasInterval ? last + interval : null;
  const expires =
    expected === null
      ? last + 48 * 60 * 60_000
      : expected + Math.max(15 * 60_000, hasInterval ? interval : 0);
  return now <= expires;
};
