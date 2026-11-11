import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { observeWifiAttempt } from "../../src/components/BluetoothWifiProvisioning/wifiConnectionStatus";

const status = (value: number) => new DataView(Uint8Array.of(value).buffer);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it.each([[1, 0], [49, 48]])("detects failed attempts with binary or ASCII status (%s → %s)", async (one, zero) => {
  const read = vi.fn().mockResolvedValueOnce(status(one)).mockResolvedValue(status(zero));
  const result = observeWifiAttempt(read, () => true);
  await vi.advanceTimersByTimeAsync(12000);
  expect(await result).toBe("failed");
});

it.each([0, 1])("does not infer failure or success from constant %s", async (value) => {
  const result = observeWifiAttempt(async () => status(value), () => true);
  await vi.advanceTimersByTimeAsync(15000);
  expect(await result).toBe("unconfirmed");
});

it("stops reading after cancellation", async () => {
  let active = true;
  const read = vi.fn(async () => status(1));
  const result = observeWifiAttempt(read, () => active);
  await vi.advanceTimersByTimeAsync(0);
  active = false;
  await vi.advanceTimersByTimeAsync(3000);
  expect(await result).toBe("cancelled");
  expect(read).toHaveBeenCalledTimes(1);
});

it("leaves disconnection or unsupported firmware unconfirmed", async () => {
  expect(await observeWifiAttempt(async () => { throw new Error("GATT unavailable"); }, () => true)).toBe("unconfirmed");
});

it("bounds a stalled browser BLE read without declaring success", async () => {
  const result = observeWifiAttempt(() => new Promise(() => {}), () => true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await result).toBe("unconfirmed");
  expect(vi.getTimerCount()).toBe(0);
});

it("does not offer retry for a transient disconnect during the firmware attempt", async () => {
  const read = vi.fn().mockResolvedValueOnce(status(1)).mockResolvedValueOnce(status(0)).mockResolvedValue(status(1));
  const result = observeWifiAttempt(read, () => true);
  await vi.advanceTimersByTimeAsync(15000);
  expect(await result).toBe("unconfirmed");
});
