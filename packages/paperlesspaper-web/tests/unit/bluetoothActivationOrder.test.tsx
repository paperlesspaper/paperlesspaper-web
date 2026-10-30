// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn() } }));

const ble = vi.hoisted(() => ({
  initialize: vi.fn(),
  setDisplayStrings: vi.fn(),
  requestDevice: vi.fn(async () => ({ deviceId: "ble-id", name: "epd7-test" })),
  connect: vi.fn(),
  disconnect: vi.fn(),
  isEnabled: vi.fn(async () => true),
  read: vi.fn(async () => "Home,-42"),
  write: vi.fn(),
}));
vi.mock("@capacitor-community/bluetooth-le", () => ({
  BleClient: ble,
  textToDataView: (v: any) => v,
  dataViewToText: (v: any) => v,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));
vi.mock("i18next", () => ({ default: { t: (v: any) => v } }));

import { useBluetoothWifiProvisioning } from "../../src/components/BluetoothWifiProvisioning/connect";

let root: ReturnType<typeof createRoot>;
let hook: ReturnType<typeof useBluetoothWifiProvisioning>;
const continueProcess = vi.fn();
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  ble.read.mockReset().mockResolvedValue("Home,-42");
  root = createRoot(document.createElement("div"));
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});
async function render(beforeWriteCredentials?: () => Promise<boolean>) {
  function Harness() {
    hook = useBluetoothWifiProvisioning({
      deviceId: "epd7-test",
      continueProcess,
      beforeWriteCredentials,
    });
    return null;
  }
  act(() => root.render(<Harness />));
  await act(async () => {
    await hook.initializeBle();
  });
}

it("waits for activation to start before writing either WLAN credential", async () => {
  let confirm: (value: boolean) => void;
  const start = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        confirm = resolve;
      })
  );
  await render(start);
  let write: Promise<void>;
  act(() => {
    write = hook.writeWifiCredentials({ ssid: "Home", password: "secret" });
  });
  expect(start).toHaveBeenCalledTimes(1);
  expect(ble.write).not.toHaveBeenCalled();
  expect(continueProcess).not.toHaveBeenCalled();
  await act(async () => {
    confirm!(true);
    await write!;
  });
  expect(ble.write.mock.calls.map((call) => call[3])).toEqual([
    "Home",
    "secret",
  ]);
  expect(continueProcess).toHaveBeenCalledTimes(1);
});

it("does not transmit credentials if activation cannot be started", async () => {
  await render(async () => false);
  await act(async () => {
    await hook.writeWifiCredentials({ ssid: "Home", password: "secret" });
  });
  expect(ble.write).not.toHaveBeenCalled();
  expect(continueProcess).not.toHaveBeenCalled();
});

it("keeps BLE open on WLAN failure and accepts corrected credentials", async () => {
  await render(async () => true);
  vi.useFakeTimers();
  ble.read.mockResolvedValueOnce(new DataView(Uint8Array.of(1).buffer) as any)
    .mockResolvedValue(new DataView(Uint8Array.of(0).buffer) as any);
  const disconnects = ble.disconnect.mock.calls.length;
  let write: Promise<void>;
  await act(async () => {
    write = hook.writeWifiCredentials({ ssid: "Home", password: "wrong" });
    // The 3-second poll first observes the 11-second retry guard at 12 seconds.
    await vi.advanceTimersByTimeAsync(12000);
    await write;
  });
  expect(hook.wifiConnectionFailed).toBe(true);
  expect(hook.connectionState).toBe("wifi-networks-password");
  expect(hook.isWriting).toBe(false);
  expect(ble.disconnect).toHaveBeenCalledTimes(disconnects);
  expect(continueProcess).not.toHaveBeenCalled();
  ble.read.mockResolvedValue("Home,-42");
  await act(async () => {
    await hook.writeWifiCredentials({ ssid: "Home", password: "corrected" });
  });
  expect(hook.wifiConnectionFailed).toBe(false);
  expect(ble.write.mock.calls.map(call => call[3])).toEqual(["Home", "wrong", "Home", "corrected"]);
  expect(continueProcess).toHaveBeenCalledTimes(1);
});

it("changes normal WLAN credentials without an activation callback", async () => {
  await render();
  await act(async () => {
    await hook.writeWifiCredentials({ ssid: "New Home", password: "" });
  });
  expect(ble.write.mock.calls.map((call) => call[3])).toEqual(["New Home", ""]);
  expect(continueProcess).toHaveBeenCalledTimes(1);
});

it("does not write after the Bluetooth flow was cancelled while starting activation", async () => {
  let confirm: (value: boolean) => void;
  await render(
    () =>
      new Promise<boolean>((resolve) => {
        confirm = resolve;
      })
  );
  let write: Promise<void>;
  act(() => {
    write = hook.writeWifiCredentials({ ssid: "Home", password: "secret" });
  });
  await act(async () => {
    await hook.cleanupBluetooth();
  });
  await act(async () => {
    confirm!(true);
    await write!;
  });
  expect(ble.write).not.toHaveBeenCalled();
  expect(continueProcess).not.toHaveBeenCalled();
});
