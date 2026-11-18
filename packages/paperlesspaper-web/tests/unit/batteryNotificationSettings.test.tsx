// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  query: {} as any,
  mutation: {} as any,
  update: vi.fn(),
  retry: vi.fn(),
  push: {} as any,
  enable: vi.fn(),
}));
vi.mock("helpers/notifications/PushContext", () => ({
  usePushContext: () => m.push,
}));
vi.mock("ducks/accounts", () => ({
  accountsApi: {
    useGetBatteryNotificationPreferenceQuery: () => m.query,
    useUpdateBatteryNotificationPreferenceMutation: () => [
      m.update,
      m.mutation,
    ],
  },
}));
vi.mock("react-i18next", () => ({ Trans: ({ children }: any) => children }));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, kind, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: ({ labelText, wrapperClassName, ...props }: any) => (
    <label>
      <input type="checkbox" {...props} />
      {labelText}
    </label>
  ),
  InputGroup: ({ labelText, helperText, children }: any) => (
    <fieldset>
      <legend>{labelText}</legend>
      <p>{helperText}</p>
      {children}
    </fieldset>
  ),
}));
import BatteryNotificationSettings from "../../src/components/Account/BatteryNotificationSettings";
const preference = (
  email = false,
  push = false,
  emptyEmail = false,
  emptyPush = false
) => ({
  low: { email, push },
  empty: { email: emptyEmail, push: emptyPush },
});
let container: HTMLDivElement;
let root: Root;
const render = async () => {
  await act(async () => root.render(<BatteryNotificationSettings />));
};
const click = async (selector: string) => {
  await act(async () =>
    container.querySelector<HTMLElement>(selector)!.click()
  );
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  m.enable.mockResolvedValue(true);
  m.push = {
    enabled: true,
    busy: false,
    supported: true,
    enableNotifications: m.enable,
  };
  m.query = {
    data: preference(),
    isSuccess: true,
    refetch: m.retry,
  };
  m.mutation = {};
  m.update.mockImplementation((value) => ({ unwrap: async () => value }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it("loads saved preferences and saves independent email and push choices", async () => {
  m.query.data = preference(true, false);
  await render();
  expect(
    container.querySelector<HTMLInputElement>(
      "#battery-notification-low-email"
    )!.checked
  ).toBe(true);
  await click("#battery-notification-low-email");
  await click("#battery-notification-low-push");
  await click("button");
  expect(m.update).toHaveBeenCalledWith(preference(false, true));
  expect(container.textContent).toContain("Notification settings saved.");
  expect(container.querySelector("button")!.type).toBe("button");
});
it("does not enable channels or save while loading or after a failed load", async () => {
  m.query = { isLoading: true };
  await render();
  expect(container.querySelector("input")!.disabled).toBe(true);
  expect(container.querySelector("button")!.disabled).toBe(true);
  m.query = { isError: true, refetch: m.retry };
  await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await click("button");
  expect(m.retry).toHaveBeenCalledOnce();
  expect(m.update).not.toHaveBeenCalled();
});
it("preserves choices after save failure and allows retry", async () => {
  await render();
  await click("#battery-notification-low-email");
  m.update.mockReturnValue({
    unwrap: async () => {
      throw new Error("offline");
    },
  });
  await click("button");
  m.mutation = { isError: true };
  await render();
  expect(
    container.querySelector<HTMLInputElement>(
      "#battery-notification-low-email"
    )!.checked
  ).toBe(true);
  expect(container.textContent).toContain("could not be saved");
  expect(container.textContent).not.toContain("Notification settings saved.");
  m.mutation = {};
  m.update.mockImplementation((value) => ({ unwrap: async () => value }));
  await render();
  await click("button");
  expect(m.update).toHaveBeenLastCalledWith(preference(true, false));
});
it("allows opting out of both channels", async () => {
  m.query.data = preference(true, true);
  await render();
  await click("#battery-notification-low-email");
  await click("#battery-notification-low-push");
  await click("button");
  expect(m.update).toHaveBeenCalledWith(preference());
});
it("does not overwrite an unsaved choice when another account query refetches", async () => {
  await render();
  await click("#battery-notification-low-email");
  m.query.data = preference(false, true);
  await render();
  expect(
    container.querySelector<HTMLInputElement>(
      "#battery-notification-low-email"
    )!.checked
  ).toBe(true);
});

it("enables Firebase before selecting the push channel", async () => {
  m.push.enabled = false;
  await render();
  await click("#battery-notification-low-push");
  expect(m.enable).toHaveBeenCalledOnce();
  expect(
    container.querySelector<HTMLInputElement>("#battery-notification-low-push")!
      .checked
  ).toBe(true);
});
it("does not select or save push after permission or registration failure", async () => {
  m.push.enabled = false;
  m.enable.mockResolvedValue(false);
  await render();
  await click("#battery-notification-low-push");
  expect(
    container.querySelector<HTMLInputElement>("#battery-notification-low-push")!
      .checked
  ).toBe(false);
  expect(container.textContent).toContain(
    "Push notifications could not be enabled"
  );
  await click("button");
  expect(m.update).toHaveBeenCalledWith(preference());
});
it("also enables Firebase before saving a previously enabled account preference", async () => {
  m.push.enabled = false;
  m.query.data = preference(true, true);
  m.enable.mockResolvedValue(false);
  await render();
  await click("button");
  expect(m.enable).toHaveBeenCalledOnce();
  expect(m.update).not.toHaveBeenCalled();
});
it("does not block email-only settings on a device without push support", async () => {
  m.push.enabled = false;
  m.push.supported = false;
  await render();
  expect(
    container.querySelector<HTMLInputElement>("#battery-notification-low-push")!
      .disabled
  ).toBe(true);
  await click("#battery-notification-low-email");
  await click("button");
  expect(m.update).toHaveBeenCalledWith(preference(true, false));
  expect(m.enable).not.toHaveBeenCalled();
});

it("saves separate channels for both warning types", async () => {
  await render();
  await click("#battery-notification-low-email");
  await click("#battery-notification-empty-push");
  await click("button");
  expect(m.update).toHaveBeenCalledWith(preference(true, false, false, true));
});
it("enables Firebase for the new no-contact push warning too", async () => {
  m.push.enabled = false;
  await render();
  await click("#battery-notification-empty-push");
  expect(m.enable).toHaveBeenCalledOnce();
  expect(
    container.querySelector<HTMLInputElement>(
      "#battery-notification-empty-push"
    )!.checked
  ).toBe(true);
  expect(
    container.querySelector<HTMLInputElement>("#battery-notification-low-push")!
      .checked
  ).toBe(false);
});
it("loads and disables all four independent preferences", async () => {
  m.query.data = preference(true, true, true, true);
  await render();
  for (const warning of ["low", "empty"])
    for (const channel of ["email", "push"])
      await click(`#battery-notification-${warning}-${channel}`);
  await click("button");
  expect(m.update).toHaveBeenCalledWith(preference());
});
