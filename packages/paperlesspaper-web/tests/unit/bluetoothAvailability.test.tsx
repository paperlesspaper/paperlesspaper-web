// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ platform: "android", enabled: true }));
const app = vi.hoisted(() => ({ addListener: vi.fn(), remove: vi.fn() }));
vi.mock("@capacitor/app", () => ({ App: app }));
const ble = vi.hoisted(() => ({
  initialize: vi.fn(),
  isEnabled: vi.fn(),
  requestEnable: vi.fn(),
  startEnabledNotifications: vi.fn(),
  stopEnabledNotifications: vi.fn(),
  isLocationEnabled: vi.fn(),
  setDisplayStrings: vi.fn(),
  requestLEScan: vi.fn(),
  stopLEScan: vi.fn(),
  requestDevice: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@capacitor-community/bluetooth-le", () => ({
  BleClient: ble,
  textToDataView: (v: unknown) => v,
  dataViewToText: (v: unknown) => v,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => native.platform !== "web",
    getPlatform: () => native.platform,
  },
}));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));
vi.mock("i18next", () => ({ default: { t: (v: unknown) => v } }));

import { useBluetoothWifiProvisioning } from "../../src/components/BluetoothWifiProvisioning/connect";

let root: ReturnType<typeof createRoot>;
let hook: ReturnType<typeof useBluetoothWifiProvisioning>;
let onEnabled: (enabled: boolean) => void;
let onAppState: (state: { isActive: boolean }) => Promise<void>;
const device = { deviceId: "ble-id", name: "epd7-test" };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  native.platform = "android";
  native.enabled = true;
  app.addListener.mockImplementation(async (_event, callback) => {
    onAppState = callback;
    return { remove: app.remove };
  });
  ble.initialize.mockResolvedValue(undefined);
  ble.isEnabled.mockImplementation(async () => native.enabled);
  ble.isLocationEnabled.mockResolvedValue(true);
  ble.requestEnable.mockImplementation(async () => {
    native.enabled = true;
  });
  ble.startEnabledNotifications.mockImplementation(async (callback) => {
    onEnabled = callback;
  });
  ble.requestLEScan.mockImplementation(async (_options, callback) => {
    callback({ device });
  });
  ble.requestDevice.mockResolvedValue(device);
  ble.read.mockResolvedValue("HomeÂ´-42");
  root = createRoot(document.createElement("div"));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

function render() {
  function Harness() {
    hook = useBluetoothWifiProvisioning({
      deviceId: "epd7-test",
      continueProcess: vi.fn(),
    });
    return null;
  }
  act(() => root.render(<Harness />));
}

it("offers retry when automatic reconnection fails", async () => {
  await initialize();
  const onDisconnect = ble.connect.mock.calls[0][1];
  ble.connect.mockRejectedValueOnce(new Error("Connection timed out"));
  await act(async () => { onDisconnect(device.deviceId); });
  expect(hook.connectionState).toBe("ble-error");
  expect(hook.connectionError.position).toBe("reconnectBluetooth");
});

it("offers retry when the Wi-Fi list read fails after the probe succeeds", async () => {
  ble.read.mockResolvedValueOnce("ready").mockRejectedValueOnce(new Error("GATT disconnected"));
  await initialize();
  expect(hook.connectionState).toBe("ble-error");
  expect(hook.connectionError.position).toBe("wifi-networks-loading");
});

it("does not let a stale Wi-Fi read hide a failed reconnection", async () => {
  let finishRead: (value: string) => void;
  ble.read.mockResolvedValueOnce("ready").mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  render();
  let initializing: Promise<void>;
  await act(async () => { initializing = hook.initializeBle(); });
  const onDisconnect = ble.connect.mock.calls[0][1];
  ble.connect.mockRejectedValueOnce(new Error("Connection timed out"));
  await act(async () => { onDisconnect(device.deviceId); });
  expect(hook.connectionState).toBe("ble-error");
  await act(async () => { finishRead!("HomeÂ´-42"); await initializing!; });
  expect(hook.connectionState).toBe("ble-error");
  expect(hook.connectionError.position).toBe("reconnectBluetooth");
});

it("ignores a late reconnection failure after the dialog was closed", async () => {
  await initialize();
  const onDisconnect = ble.connect.mock.calls[0][1];
  let rejectReconnect: (error: Error) => void;
  ble.connect.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectReconnect = reject; }));
  await act(async () => { onDisconnect(device.deviceId); });
  await act(async () => { await hook.cleanupBluetooth(); });
  const stateAfterClose = hook.connectionState;
  await act(async () => { rejectReconnect!(new Error("Connection timed out")); });
  expect(hook.connectionState).toBe(stateAfterClose);
  expect(hook.connectionError.position).not.toBe("reconnectBluetooth");
});

async function initialize() {
  render();
  await act(async () => {
    await hook.initializeBle();
  });
}

it("blocks scanning immediately when Android Bluetooth is off, before checking location", async () => {
  native.enabled = false;
  await initialize();
  expect(hook.connectionState).toBe("ble-enabled-error");
  expect(ble.requestLEScan).not.toHaveBeenCalled();
  expect(ble.connect).not.toHaveBeenCalled();
  expect(ble.isLocationEnabled).not.toHaveBeenCalled();
  expect(ble.requestEnable).not.toHaveBeenCalled();
  expect(hook.debugInfo.scanTimeoutActive).toBe(false);
});

it("resumes Android provisioning after accepting the system enable dialog", async () => {
  native.enabled = false;
  await initialize();
  await act(async () => {
    await hook.requestEnable();
  });
  expect(ble.requestEnable).toHaveBeenCalledTimes(1);
  expect(ble.requestLEScan).toHaveBeenCalledTimes(1);
  expect(hook.connectionState).toBe("wifi-networks-display");
  expect(hook.isRequestingEnable).toBe(false);
});

it("keeps the disabled screen when the Android enable dialog is dismissed", async () => {
  native.enabled = false;
  ble.requestEnable.mockRejectedValue(new Error("requestEnable failed."));
  await initialize();
  await act(async () => {
    await hook.requestEnable();
  });
  expect(hook.connectionState).toBe("ble-enabled-error");
  expect(ble.requestLEScan).not.toHaveBeenCalled();
  expect(hook.isRequestingEnable).toBe(false);
});

it("rechecks the adapter even when the enable dialog resolves successfully", async () => {
  native.enabled = false;
  ble.requestEnable.mockResolvedValue(undefined);
  await initialize();
  await act(async () => {
    await hook.requestEnable();
  });
  expect(hook.connectionState).toBe("ble-enabled-error");
  expect(ble.requestLEScan).not.toHaveBeenCalled();
});

it.each(["android", "ios"])(
  "supports enabling Bluetooth manually and retrying on %s",
  async (platform) => {
    native.platform = platform;
    native.enabled = false;
    await initialize();
    expect(hook.connectionState).toBe("ble-enabled-error");
    expect(hook.canRequestEnable).toBe(platform === "android");
    native.enabled = true;
    await act(async () => {
      await hook.initializeBle();
    });
    expect(hook.connectionState).toBe("wifi-networks-display");
    expect(ble.requestEnable).not.toHaveBeenCalled();
  }
);

it("never calls Android-only APIs on iOS, including the enable action", async () => {
  native.platform = "ios";
  native.enabled = false;
  await initialize();
  await act(async () => {
    await hook.requestEnable();
  });
  expect(hook.connectionState).toBe("ble-enabled-error");
  native.enabled = true;
  await act(async () => {
    await hook.initializeBle();
  });
  expect(hook.connectionState).toBe("wifi-networks-display");
  expect(ble.requestEnable).not.toHaveBeenCalled();
  expect(ble.isLocationEnabled).not.toHaveBeenCalled();
});

it("preserves Chrome's device chooser without native checks, listeners or scanning", async () => {
  native.platform = "web";
  native.enabled = false;
  await initialize();
  expect(hook.connectionState).toBe("wifi-networks-display");
  expect(ble.requestDevice).toHaveBeenCalledTimes(1);
  expect(ble.connect).toHaveBeenCalledWith("ble-id", expect.any(Function), {
    timeout: 20000,
  });
  await act(async () => {
    await hook.cleanupBluetooth();
  });
  for (const method of [
    ble.isEnabled,
    ble.requestEnable,
    ble.isLocationEnabled,
    ble.startEnabledNotifications,
    ble.stopEnabledNotifications,
    ble.requestLEScan,
    ble.stopLEScan,
  ]) {
    expect(method).not.toHaveBeenCalled();
  }
});

it.each(["android", "ios"])(
  "stops a pending %s scan when Bluetooth turns off and ignores stale callbacks",
  async (platform) => {
    vi.useFakeTimers();
    native.platform = platform;
    let onScan: (result: unknown) => void;
    ble.requestLEScan.mockImplementation(async (_options, callback) => {
      onScan = callback;
    });
    render();
    let pending: Promise<void>;
    await act(async () => {
      pending = hook.initializeBle();
    });
    expect(ble.requestLEScan).toHaveBeenCalledTimes(1);
    const staleEnabled = onEnabled;
    await act(async () => {
      native.enabled = false;
      onEnabled(false);
      await pending!;
    });
    expect(hook.connectionState).toBe("ble-enabled-error");
    expect(ble.stopEnabledNotifications).toHaveBeenCalledTimes(1);
    expect(hook.debugInfo.scanTimeoutActive).toBe(false);
    expect(hook.debugInfo.nativeScanPending).toBe(false);
    await act(async () => {
      onScan!({ device });
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(ble.connect).not.toHaveBeenCalled();
    expect(hook.connectionState).toBe("ble-enabled-error");
    native.enabled = true;
    ble.requestLEScan.mockImplementation(async (_options, callback) => {
      callback({ device });
    });
    await act(async () => {
      await hook.initializeBle();
    });
    await act(async () => {
      staleEnabled(false);
    });
    expect(hook.connectionState).toBe("wifi-networks-display");
  }
);

it("detects Bluetooth turning off between the first check and listener registration", async () => {
  ble.startEnabledNotifications.mockImplementation(async () => {
    native.enabled = false;
  });
  await initialize();
  expect(hook.connectionState).toBe("ble-enabled-error");
  expect(ble.requestLEScan).not.toHaveBeenCalled();
  expect(ble.stopEnabledNotifications).toHaveBeenCalledTimes(1);
});

it.each(["Permission denied.", "BLE permission denied"])(
  "preserves permission errors (%s) rather than reporting Bluetooth off",
  async (message) => {
    ble.initialize.mockRejectedValue(new Error(message));
    await initialize();
    expect(hook.connectionState).toBe("ble-error");
    expect(hook.connectionError.message).toBe(message);
    expect(ble.isEnabled).not.toHaveBeenCalled();
    expect(ble.requestEnable).not.toHaveBeenCalled();
  }
);

it("does not restart after cancellation while the enable dialog is open", async () => {
  native.enabled = false;
  let accept: () => void;
  ble.requestEnable.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        accept = resolve;
      })
  );
  await initialize();
  let pending: Promise<void>;
  await act(async () => {
    pending = hook.requestEnable();
  });
  expect(hook.isRequestingEnable).toBe(true);
  await act(async () => {
    await hook.cleanupBluetooth();
  });
  await act(async () => {
    native.enabled = true;
    accept!();
    await pending!;
  });
  expect(ble.requestLEScan).not.toHaveBeenCalled();
});

it("removes the adapter listener on unmount", async () => {
  await initialize();
  await act(async () => root.unmount());
  expect(ble.stopEnabledNotifications).toHaveBeenCalledTimes(1);
  await act(async () => {
    onEnabled(false);
  });
  expect(ble.stopEnabledNotifications).toHaveBeenCalledTimes(1);
});

it("does not let a late empty Wi-Fi read overwrite the Bluetooth-off screen", async () => {
  let finishRead: (value: string) => void;
  ble.read.mockResolvedValueOnce("HomeÂ´-42").mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finishRead = resolve;
      })
  );
  render();
  let pending: Promise<void>;
  await act(async () => {
    pending = hook.initializeBle();
  });
  expect(hook.connectionState).toBe("wifi-networks-loading");
  await act(async () => {
    native.enabled = false;
    onEnabled(false);
    finishRead!("");
    await pending!;
  });
  expect(hook.connectionState).toBe("ble-enabled-error");
});

it("does not start a scan if unmounted during initialization", async () => {
  let finish: () => void;
  ble.initialize.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  render();
  let pending: Promise<void>;
  await act(async () => {
    pending = hook.initializeBle();
  });
  await act(async () => root.unmount());
  await act(async () => {
    finish!();
    await pending!;
  });
  expect(ble.requestLEScan).not.toHaveBeenCalled();
  expect(ble.startEnabledNotifications).not.toHaveBeenCalled();
});

it("automatically resumes iOS setup when returning from Settings with Bluetooth enabled", async () => {
  native.platform = "ios";
  native.enabled = false;
  await initialize();
  expect(app.addListener).toHaveBeenCalledWith(
    "appStateChange",
    expect.any(Function)
  );
  native.enabled = true;
  await act(async () => {
    await onAppState({ isActive: true });
  });
  expect(hook.connectionState).toBe("wifi-networks-display");
  expect(ble.requestLEScan).toHaveBeenCalledTimes(1);
  expect(ble.requestEnable).not.toHaveBeenCalled();
  expect(app.remove).toHaveBeenCalledTimes(1);
});

it("keeps iOS setup paused while Bluetooth is off or the app is in the background", async () => {
  native.platform = "ios";
  native.enabled = false;
  await initialize();
  await act(async () => {
    await onAppState({ isActive: true });
  });
  expect(hook.connectionState).toBe("ble-enabled-error");
  native.enabled = true;
  await act(async () => {
    await onAppState({ isActive: false });
  });
  expect(ble.requestLEScan).not.toHaveBeenCalled();
  expect(ble.initialize).toHaveBeenCalledTimes(1);
});

it("does not duplicate iOS setup for repeated foreground events", async () => {
  native.platform = "ios";
  native.enabled = false;
  await initialize();
  native.enabled = true;
  await act(async () => {
    await Promise.all([
      onAppState({ isActive: true }),
      onAppState({ isActive: true }),
    ]);
  });
  expect(ble.requestLEScan).toHaveBeenCalledTimes(1);
});

it("ignores an iOS foreground check that completes after cancellation", async () => {
  native.platform = "ios";
  native.enabled = false;
  await initialize();
  let finishCheck: (enabled: boolean) => void;
  ble.isEnabled.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finishCheck = resolve;
      })
  );
  let pending: Promise<void>;
  await act(async () => {
    pending = onAppState({ isActive: true });
  });
  await act(async () => {
    await hook.cleanupBluetooth();
  });
  await act(async () => {
    finishCheck!(true);
    await pending!;
  });
  expect(ble.requestLEScan).not.toHaveBeenCalled();
});

it("removes the iOS foreground listener and ignores its callbacks after unmount", async () => {
  native.platform = "ios";
  native.enabled = false;
  await initialize();
  await act(async () => root.unmount());
  expect(app.remove).toHaveBeenCalledTimes(1);
  native.enabled = true;
  await act(async () => {
    await onAppState({ isActive: true });
  });
  expect(ble.requestLEScan).not.toHaveBeenCalled();
});

it("removes an iOS foreground listener even if registration finishes after unmount", async () => {
  native.platform = "ios";
  native.enabled = false;
  let register: (handle: { remove: typeof app.remove }) => void;
  app.addListener.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        register = resolve;
      })
  );
  await initialize();
  await act(async () => root.unmount());
  await act(async () => {
    register!({ remove: app.remove });
  });
  expect(app.remove).toHaveBeenCalledTimes(1);
});

it.each(["android", "web"])(
  "does not install iOS foreground recovery on %s",
  async (platform) => {
    native.platform = platform;
    native.enabled = false;
    await initialize();
    expect(app.addListener).not.toHaveBeenCalled();
  }
);
