import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  level: 4200 as number | undefined,
  age: 0,
  kind: "epd7",
  usbConnected: false,
}));
vi.mock("ducks/devices", () => ({
  devicesApi: {
    useGetSingleDevicesQuery: () => ({
      status: "fulfilled",
      originalArgs: "test",
      isLoading: false,
      isFetching: false,
      data: {
        deviceStatus: {
          batLevel: state.level,
          usbConnected: state.usbConnected,
          sleepTime: 3600,
          lastReachableAgo: new Date(
            Date.now() - state.age * 86400000
          ).toISOString(),
        },
      },
    }),
  },
}));
vi.mock("helpers/useUsers", () => ({
  useActiveUserDevice: () => ({
    data: { id: "test", kind: state.kind },
    isLoading: false,
  }),
}));
vi.mock("@progressiveui/react", () => ({
  InlineLoading: () => null,
  Button: () => null,
  BlockNotification: ({ title, subtitle }: any) => (
    <section>
      {title}
      {subtitle}
    </section>
  ),
}));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) =>
    Array.isArray(children)
      ? children.map((child: any) =>
          typeof child === "object" && !React.isValidElement(child)
            ? Object.values(child).join("")
            : child
        )
      : children,
  useTranslation: () => ({ t: (s: string) => s }),
}));
vi.mock("@internetderdinge/web", () => ({
  useIsDesktop: () => true,
  useVisibility: () => true,
}));
vi.mock("components/ButtonRouter", () => ({ default: () => null }));
vi.mock("components/Settings/components/AddIcon", () => ({
  default: () => null,
}));
vi.mock("../../src/components/SettingsDevices/ConnectWifiBluetooth", () => ({
  default: () => null,
}));
vi.mock("../../src/components/Battery/battery.module.scss", () => ({
  default: { battery: "battery", green: "green", red: "red", orange: "orange" },
}));
vi.mock(
  "../../src/components/SettingsDevices/deviceStatus.module.scss",
  () => ({ default: {} })
);
import Battery from "../../src/components/Battery";
import DeviceStatus from "../../src/components/SettingsDevices/DeviceStatus";
const battery = () =>
  renderToStaticMarkup(
    <Battery device={{ id: "test", kind: state.kind }} showPercentage />
  );
beforeEach(() => {
  state.level = 4200;
  state.age = 0;
  state.kind = "epd7";
  state.usbConnected = false;
});

it("renders the same low battery in the icon and settings warning", () => {
  expect(battery()).toContain("0%");
  expect(battery()).toContain("red");
  const html = renderToStaticMarkup(<DeviceStatus id="test" />);
  expect(html).toContain("Battery low");
  expect(html).not.toContain("Reconnect Wifi");
});
it("retains Wifi help for a healthy battery", () => {
  state.level = 4660;
  expect(renderToStaticMarkup(<DeviceStatus id="test" />)).toContain(
    "Reconnect Wifi"
  );
});
it("shows unknown voltage ahead of Wifi help", () => {
  state.level = undefined;
  expect(battery()).toContain("no battery level available");
  expect(battery()).not.toContain("NaN%");
  expect(renderToStaticMarkup(<DeviceStatus id="test" />)).toContain(
    "No battery level available"
  );
});
it("renders charging for USB even without showPercentage or a voltage reading", () => {
  state.usbConnected = true;
  state.level = undefined;
  const html = renderToStaticMarkup(
    <Battery device={{ id: "test", kind: "epd7" }} />
  );
  expect(html).toContain("charging");
  expect(html).toContain("<mask");
  expect(html).not.toContain("NaN");
  expect(renderToStaticMarkup(<DeviceStatus id="test" />)).toContain(
    "charging"
  );
});
it("does not render charging when USB is disconnected", () => {
  expect(battery()).not.toContain("charging");
});
it("stale USB and voltage are not displayed as current", () => {
  state.usbConnected = true;
  state.level = 4660;
  state.age = 3 / 24;
  expect(battery()).not.toContain("charging");
  expect(battery()).not.toMatch(/\d+%/);
  expect(battery()).toContain("last seen");
  expect(renderToStaticMarkup(<DeviceStatus id="test" />)).toContain(
    "Device offline"
  );
});
it("clamps voltage below the configured minimum to an empty battery", () => {
  state.level = 4000;
  expect(battery()).toContain("0%");
  expect(battery()).not.toContain("-14%");
});
it("still warns when only warnings are requested", () => {
  expect(
    renderToStaticMarkup(<DeviceStatus id="test" show="warnings" />)
  ).toContain("Battery low");
});

it("shows USB power on older EPD devices without battery-level support", () => {
  state.kind = "epaper";
  state.usbConnected = true;
  expect(battery()).toContain("charging");
  expect(renderToStaticMarkup(<DeviceStatus id="test" />)).toContain(
    "charging"
  );
});

it("renders the accepted Alkaline estimate instead of saturating at 4800 mV", () => {
  state.level = 5254;
  expect(battery()).toContain("≈ 59%");
  expect(battery()).not.toContain("100%");
});
it("does not mistake a low estimated percentage for the firmware low-voltage threshold", () => {
  state.level = 4660;
  expect(battery()).toContain("≈ 26%");
  expect(renderToStaticMarkup(<DeviceStatus id="test" />)).not.toContain(
    "Battery low"
  );
});
