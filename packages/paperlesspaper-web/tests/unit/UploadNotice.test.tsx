// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: "alice",
  organization: "org",
  devices: [] as any[],
}));
vi.mock("helpers/useAccount", () => ({
  default: () => ({ user: { sub: mocks.account } }),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ organization: mocks.organization }),
}));
vi.mock("@internetderdinge/web", () => ({ useLocaleDate: () => ({}) }));
vi.mock("helpers/formatDistanceShort", () => ({
  default: (next: Date, now: Date) =>
    `${Math.round((+next - +now) / 60000)} min`,
}));
vi.mock("ducks/devices", () => ({
  devicesApi: { useGetAllDevicesQuery: () => ({ data: mocks.devices }) },
}));
vi.mock("@progressiveui/react", () => ({
  Callout: ({ title, children }: any) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey, values, children }: any) =>
    i18nKey ? i18nKey.replace("{{nextSync}}", values.nextSync) : children,
}));
import UploadNotice from "../../src/components/Epaper/UploadNotice";
import {
  recordSuccessfulUpload,
  dismissUploadNotice,
} from "../../src/helpers/uploadNotice";
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
const notice = {
  organization: "org",
  frameIds: ["target"],
  addedToSlideshow: false,
};
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.account = `account-${Math.random()}`;
  mocks.organization = "org";
  mocks.devices = [
    {
      id: "active",
      deviceStatus: {
        nextDeviceSync: new Date(Date.now() + 60 * 60000).toISOString(),
      },
    },
    {
      id: "target",
      deviceStatus: {
        nextDeviceSync: new Date(Date.now() + 12 * 60000).toISOString(),
      },
    },
  ];
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));
it("receives background success after mount, uses the target time and can be dismissed", () => {
  act(() => root.render(<UploadNotice />));
  expect(container.textContent).toBe("");
  act(() => recordSuccessfulUpload(mocks.account, notice));
  expect(container.textContent).toContain("Expected in 12 min.");
  expect(container.textContent).not.toContain("60 min");
  act(() => container.querySelector("button")!.click());
  expect(container.textContent).toBe("");
  act(() => root.render(<UploadNotice />));
  expect(container.textContent).toBe("");
});
it("omits a countdown for unknown, overdue, multiple-frame and slideshow destinations", () => {
  act(() => root.render(<UploadNotice />));
  for (const frameIds of [["unknown"], ["target"], ["active", "target"]]) {
    mocks.devices[1].deviceStatus.nextDeviceSync = new Date(
      Date.now() - 1000,
    ).toISOString();
    act(() => recordSuccessfulUpload(mocks.account, { ...notice, frameIds }));
    expect(container.textContent).not.toContain("Expected in");
  }
  act(() =>
    recordSuccessfulUpload(mocks.account, {
      ...notice,
      frameIds: [],
      addedToSlideshow: true,
    }),
  );
  expect(container.textContent).toContain("playback order");
  expect(container.textContent).not.toContain("download the image");
});
it("does not leak a notice into a different organization or account", () => {
  recordSuccessfulUpload(mocks.account, notice);
  mocks.organization = "other";
  act(() => root.render(<UploadNotice />));
  expect(container.textContent).toBe("");
  mocks.organization = "org";
  mocks.account = "another-account";
  act(() => root.render(<UploadNotice />));
  expect(container.textContent).toBe("");
});
it("shows library-only wording without a wake-up instruction", () => {
  recordSuccessfulUpload(mocks.account, { ...notice, frameIds: [] });
  act(() => root.render(<UploadNotice />));
  expect(container.textContent).toContain("saved in your library");
  expect(container.textContent).not.toContain("button on the back");
  act(() => dismissUploadNotice(mocks.account));
});
