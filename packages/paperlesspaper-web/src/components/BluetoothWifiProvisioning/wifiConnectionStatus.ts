// Firmware sets 1 BEFORE WiFi.begin(), and resets it to 0 on failure.
// Neither a persistent 1 nor a BLE disconnect proves successful activation.
export async function observeWifiAttempt(
  read: () => Promise<DataView>,
  isActive: () => boolean
): Promise<"failed" | "unconfirmed" | "cancelled"> {
  const deadline = Date.now() + 15000;
  let sawAttempt = false;
  let retrySafeAt = Infinity;
  while (isActive() && Date.now() < deadline) {
    let value: DataView;
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Web Bluetooth does not enforce the native client's timeout option.
      value = await Promise.race([
        read(),
        new Promise<never>((_, reject) => {
          readTimer = setTimeout(() => reject(new Error("Wi-Fi status read timed out")),
            Math.min(5000, Math.max(1, deadline - Date.now())));
        }),
      ]);
    } catch {
      // Older firmware may lack this characteristic; successful provisioning
      // may also close BLE. Leave confirmation to the existing cloud flow.
      return isActive() ? "unconfirmed" : "cancelled";
    } finally {
      clearTimeout(readTimer);
    }
    if (!isActive()) return "cancelled";
    if (!(value instanceof DataView) || value.byteLength !== 1) return "unconfirmed";
    const status = value.getUint8(0);
    if (status === 1 || status === 49) {
      if (!sawAttempt) retrySafeAt = Date.now() + 11000;
      sawAttempt = true;
    }
    else if (status === 0 || status === 48) {
      // The Wi-Fi event handler also writes 0 on transient disconnects.
      // Wait beyond the firmware's 10s attempt before offering another write:
      // its failure cleanup clears blePASS and could erase an early retry.
      if (sawAttempt && Date.now() >= retrySafeAt) return "failed";
    } else return "unconfirmed";
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return isActive() ? "unconfirmed" : "cancelled";
}
