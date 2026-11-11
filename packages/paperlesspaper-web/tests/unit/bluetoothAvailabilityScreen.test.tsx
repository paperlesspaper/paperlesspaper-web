// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connectionState: "ble-enabled-error",
  connectionError: {} as any,
  initializedBle: true,
  canRequestEnable: true,
  isIos: false,
  isRequestingEnable: false,
  initializeBle: vi.fn(),
  requestEnable: vi.fn(),
  openAppSettings: vi.fn(),
  wifiNetworks: [{ ssid: "Test network", rssi: -40 }],
  writeWifiCredentials: vi.fn(),
}));
vi.mock("../../src/components/BluetoothWifiProvisioning/connect", () => ({
  useBluetoothWifiProvisioning: () => state,
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Checkbox: () => null,
  TextInput: () => null,
  PasswordInput: () => null,
}));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => <>{children}</>,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("components/SettingsDevices/SettingsDevicesNew", () => ({
  InfoWrapper: ({ children, bottom }: any) => <div>{children}{bottom}</div>,
  DebugScreenSwitcher: () => null,
  HelpLink: () => null,
}));
vi.mock("components/SettingsDevices/EpaperFrame", () => ({
  default: () => null,
}));
vi.mock("components/SettingsDevices/DebugErrorDetails", () => ({
  default: () => null,
}));
vi.mock("helpers/useCurrentUser", () => ({ useDebug: () => false }));

import BluetoothWifiProvisioning from "../../src/components/BluetoothWifiProvisioning";

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const buttons = () => [...container.querySelectorAll("button")];
const button = (label: string) =>
  buttons().find((element) => element.textContent === label);
const click = (label: string) => {
  const element = button(label);
  expect(element).toBeTruthy();
  act(() => element!.click());
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
  vi.clearAllMocks();
  state.connectionState = "ble-enabled-error";
  state.initializedBle = true;
  state.connectionError = {};
  state.canRequestEnable = true;
  state.isIos = false;
  state.isRequestingEnable = false;
});
afterEach(() => act(() => root.unmount()));

function show(props = {}) {
  act(() =>
    root.render(
      <BluetoothWifiProvisioning
        setAllowSubmit={vi.fn()}
        formValues={{ deviceId: "epd7-test" }}
        {...props}
      />
    )
  );
}

it("can confirm an existing Wi-Fi connection without opening Bluetooth or writing credentials", () => {
  state.initializedBle = false;
  const onUseExistingWifi = vi.fn();
  show({ onUseExistingWifi });
  expect(onUseExistingWifi).not.toHaveBeenCalled();
  click("Device is already connected to Wi-Fi");
  expect(onUseExistingWifi).toHaveBeenCalledTimes(1);
  expect(state.initializeBle).not.toHaveBeenCalled();
  expect(state.writeWifiCredentials).not.toHaveBeenCalled();
});

it("does not offer registration via existing Wi-Fi in the ordinary Wi-Fi change dialog", () => {
  state.initializedBle = false;
  show();
  expect(button("Device is already connected to Wi-Fi")).toBeUndefined();
  expect(button("Setup WiFi")).toBeTruthy();
});

it("offers Android's enable dialog and a manual retry without linking to app permissions", () => {
  show();
  expect(container.textContent).toContain("Bluetooth is turned off");
  click("Turn on Bluetooth");
  expect(state.requestEnable).toHaveBeenCalledTimes(1);
  click("Try again");
  expect(state.initializeBle).toHaveBeenCalledTimes(1);
  expect(button("Open app settings")).toBeUndefined();
});

it("shows Settings instructions and only retry on iOS", () => {
  state.canRequestEnable = false;
  state.isIos = true;
  show();
  expect(container.textContent).toContain(
    "Enable Bluetooth in Settings > Bluetooth. Setup will resume when you return."
  );
  expect(button("Turn on Bluetooth")).toBeUndefined();
  click("Try again");
  expect(state.initializeBle).toHaveBeenCalledTimes(1);
  expect(state.requestEnable).not.toHaveBeenCalled();
});

it("disables both actions while the enable dialog is open", () => {
  state.isRequestingEnable = true;
  show();
  for (const button of buttons()) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    act(() => button.click());
  }
  expect(state.requestEnable).not.toHaveBeenCalled();
  expect(state.initializeBle).not.toHaveBeenCalled();
});

it.each([
  { message: "Permission denied." },
  { message: "BLE permission denied" },
  { errorMessage: "BLE permission denied" },
])("keeps permission-denied recovery separate: %j", (error) => {
  state.connectionState = "ble-error";
  state.connectionError = { error };
  show();
  expect(container.textContent).toContain("No Bluetooth permission");
  click("Open app settings");
  expect(state.openAppSettings).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toContain("Bluetooth is turned off");
});

it("does not submit the enclosing device settings when the Wi-Fi modal submits", async () => {
  state.connectionState = "wifi-networks-password";
  const saveDeviceSettings = vi.fn((event) => event.preventDefault());
  const portal = document.createElement("div");
  document.body.appendChild(portal);
  try {
    await act(async () => root.render(
      <form onSubmit={saveDeviceSettings}>
        {createPortal(
          <BluetoothWifiProvisioning
            setAllowSubmit={vi.fn()}
            formValues={{ deviceId: "epd7-test" }}
          />,
          portal,
        )}
      </form>
    ));
    await act(async () => {
      portal.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(state.writeWifiCredentials).toHaveBeenCalledTimes(1);
    expect(saveDeviceSettings).not.toHaveBeenCalled();
  } finally {
    portal.remove();
  }
});
