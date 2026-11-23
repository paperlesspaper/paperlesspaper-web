// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  query: {} as any,
  account: {} as any,
  mutation: {} as any,
  update: vi.fn(),
  retry: vi.fn(),
  push: {} as any,
  enable: vi.fn(),
}));
vi.mock("helpers/notifications/PushContext", () => ({
  usePushContext: () => m.push,
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({}) }));
vi.mock("../../src/helpers/useQs", () => ({ default: () => ({}) }));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => children,
  useTranslation: () => ({ t: (key: string) => key }),
}));
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
  Input: ({ labelText, helperText, children }: any) => (
    <fieldset>
      <legend>{labelText}</legend>
      <p>{helperText}</p>
      {children}
    </fieldset>
  ),
}));
import BatteryNotificationSettings from "../../src/components/Account/BatteryNotificationSettings";
import useSettingsForm from "../../src/helpers/useSettingsFormNew";
const preference = (
  email = false,
  push = false,
  emptyEmail = false,
  emptyPush = false
) => ({
  low: { email, push },
  empty: { email: emptyEmail, push: emptyPush },
});
const api = {
  name: "accounts",
  useGetSingleAccountsQuery: () => m.account,
  useCreateSingleAccountsMutation: () => [vi.fn(), {}],
  useUpdateSingleAccountsMutation: () => [m.update, m.mutation],
  useDeleteSingleAccountsMutation: () => [vi.fn(), {}],
};
let store: ReturnType<typeof useSettingsForm>;
function AccountForm() {
  store = useSettingsForm({
    api,
    id: "account",
    preserveDirtyOnLoad: true,
    prepareFormEntry: (account) => ({
      given_name: account?.given_name,
      batteryNotifications: m.query.data,
    }),
    prepareSubmit: (values) => ({
      ...values,
      batteryNotifications: m.query.isSuccess
        ? values.batteryNotifications
        : undefined,
    }),
  });
  return (
    <form onSubmit={store.handleSubmit(store.onSubmit)}>
      <input {...store.form.register("given_name")} />
      <BatteryNotificationSettings
        form={store.form}
        query={m.query}
        accountLoaded={m.account.isSuccess}
      />
      <button type="submit" data-testid="account-save">
        Save account
      </button>
    </form>
  );
}
let container: HTMLDivElement;
let root: Root;
const render = async () => {
  await act(async () => root.render(<AccountForm />));
};
const click = async (selector: string) => {
  await act(async () =>
    container.querySelector<HTMLElement>(selector)!.click()
  );
};
const save = () => click('[data-testid="account-save"]');
const checkbox = (warning = "low", channel = "email") =>
  container.querySelector<HTMLInputElement>(
    `#battery-notification-${warning}-${channel}`
  )!;
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
  m.account = { isSuccess: true, data: { given_name: "Paperless" } };
  m.query = { data: preference(), isSuccess: true, refetch: m.retry };
  m.mutation = {};
  m.update.mockResolvedValue({ data: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it("uses only the account save button and submits profile and all warning choices together", async () => {
  m.query.data = preference(true, false);
  await render();
  expect(checkbox().checked).toBe(true);
  expect(container.querySelectorAll("button")).toHaveLength(1);
  await click("#battery-notification-low-email");
  await click("#battery-notification-low-push");
  await click("#battery-notification-empty-email");
  expect(m.update).not.toHaveBeenCalled();
  expect(store.isDirtyAlt).toBe(true);
  await save();
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "account",
      values: expect.objectContaining({
        given_name: "Paperless",
        batteryNotifications: preference(false, true, true),
      }),
    })
  );
  expect(store.isDirtyAlt).toBe(false);
});
it("does not overwrite unloaded preferences when saving the account", async () => {
  m.query = { isLoading: true, refetch: m.retry };
  await render();
  expect(checkbox().disabled).toBe(true);
  await save();
  expect(m.update.mock.calls[0][0].values.batteryNotifications).toBeUndefined();
  m.query = { isError: true, refetch: m.retry };
  await render();
  await click('button[type="button"]');
  expect(m.retry).toHaveBeenCalledOnce();
});
it("preserves dirty warning choices after save failure and allows retry", async () => {
  await render();
  await click("#battery-notification-low-email");
  m.update.mockResolvedValue({ error: { status: 500 } });
  await save();
  expect(checkbox().checked).toBe(true);
  expect(store.isDirtyAlt).toBe(true);
  m.query.data = preference(false, true);
  await render();
  expect(checkbox().checked).toBe(true);
  m.update.mockResolvedValue({ data: {} });
  await save();
  expect(m.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      values: expect.objectContaining({
        batteryNotifications: preference(true, true),
      }),
    })
  );
  expect(store.isDirtyAlt).toBe(false);
});
it("loads preferences arriving after the account without marking the form dirty", async () => {
  m.query = { isLoading: true, refetch: m.retry };
  await render();
  m.query = {
    isSuccess: true,
    data: preference(true, true, true, true),
    refetch: m.retry,
  };
  await render();
  expect(checkbox().checked).toBe(true);
  expect(checkbox("empty", "push").checked).toBe(true);
  expect(store.isDirtyAlt).toBe(false);
});
it("preserves edits when account data arrives after preferences", async () => {
  m.account = { isSuccess: false };
  await render();
  await click("#battery-notification-low-email");
  m.account = { isSuccess: true, data: { given_name: "Paperless" } };
  await render();
  expect(checkbox().checked).toBe(true);
  expect(store.form.getValues("given_name")).toBe("Paperless");
});
it("restores warning preferences with the normal account reset", async () => {
  await render();
  await click("#battery-notification-low-email");
  await act(async () => store.resetForm());
  expect(checkbox().checked).toBe(false);
  expect(store.isDirtyAlt).toBe(false);
});
it.each(["low", "empty"])(
  "enables Firebase before selecting %s push alerts",
  async (warning) => {
    m.push.enabled = false;
    await render();
    await click(`#battery-notification-${warning}-push`);
    expect(m.enable).toHaveBeenCalledOnce();
    expect(checkbox(warning, "push").checked).toBe(true);
    expect(store.isDirtyAlt).toBe(true);
  }
);
it("does not select push after permission or registration failure", async () => {
  m.push.enabled = false;
  m.enable.mockResolvedValue(false);
  await render();
  await click("#battery-notification-low-push");
  expect(checkbox("low", "push").checked).toBe(false);
  expect(container.textContent).toContain(
    "Push notifications could not be enabled"
  );
  await save();
  expect(m.update.mock.calls[0][0].values.batteryNotifications).toEqual(
    preference()
  );
});
it.each([false, true])(
  "saves email without local push permission and preserves push preferences (supported=%s)",
  async (supported) => {
    m.push.enabled = false;
    m.push.supported = supported;
    m.enable.mockResolvedValue(false);
    m.query.data = preference(true, true, true, true);
    await render();
    await click("#battery-notification-low-email");
    await click("#battery-notification-empty-email");
    await save();
    expect(m.update.mock.calls[0][0].values.batteryNotifications).toEqual(
      preference(false, true, false, true)
    );
    expect(m.enable).not.toHaveBeenCalled();
  }
);
it("allows opting out of all four channels", async () => {
  m.query.data = preference(true, true, true, true);
  await render();
  for (const warning of ["low", "empty"])
    for (const channel of ["email", "push"])
      await click(`#battery-notification-${warning}-${channel}`);
  await save();
  expect(m.update.mock.calls[0][0].values.batteryNotifications).toEqual(
    preference()
  );
});
it("disables editing while the common account save is pending", async () => {
  let finish!: (value: unknown) => void;
  m.update.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await render();
  await save();
  expect(checkbox().disabled).toBe(true);
  await act(async () => finish({ data: {} }));
  expect(checkbox().disabled).toBe(false);
});

it("waits for push activation before allowing the common account save", async () => {
  let finish!: (enabled: boolean) => void;
  m.push.enabled = false;
  m.enable.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await render();
  await click("#battery-notification-low-push");
  await save();
  expect(m.update).not.toHaveBeenCalled();
  await act(async () => finish(true));
  await save();
  expect(m.update.mock.calls[0][0].values.batteryNotifications.low.push).toBe(
    true
  );
});
