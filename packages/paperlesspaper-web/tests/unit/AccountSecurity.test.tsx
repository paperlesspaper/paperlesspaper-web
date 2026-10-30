// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  data: {} as any,
  update: vi.fn(),
  confirm: vi.fn(),
  login: vi.fn(),
  claims: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    user: { sub: "auth0|owner" },
    isLoading: false,
    getIdTokenClaims: mocks.claims,
    loginWithPopup: mocks.login,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params: any = {}) =>
      key.replace(/{{(\w+)}}/g, (_, name) => params[name] || ""),
    i18n: { language: "en" },
  }),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock("components/Mfa", () => ({
  default: () => <button>Manage MFA</button>,
}));
vi.mock("../../src/components/Account/accountSecurity.module.scss", () => ({
  default: {},
}));
vi.mock("ducks/accounts", () => ({
  accountsApi: {
    useGetAccountSecurityQuery: () => ({ data: mocks.data }),
    useUpdateAccountSecurityMutation: () => [
      mocks.update,
      { reset: mocks.reset, isLoading: false },
    ],
    useConfirmAccountEmailMutation: () => [
      mocks.confirm,
      { reset: mocks.reset, isLoading: false },
    ],
  },
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, kind, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Modal: ({
    children,
    modalHeading,
    primaryButtonText,
    primaryButtonDisabled,
    onRequestSubmit,
    onRequestClose,
  }: any) => (
    <div role="dialog">
      <h2>{modalHeading}</h2>
      {children}
      <button disabled={primaryButtonDisabled} onClick={onRequestSubmit}>
        {primaryButtonText}
      </button>
      <button onClick={onRequestClose}>Cancel</button>
    </div>
  ),
  TextInput: ({
    labelText,
    id,
    helperText,
    invalid,
    invalidText,
    addonAfter,
    ...props
  }: any) => (
    <label htmlFor={id}>
      {labelText}
      <input id={id} {...props} />
      {invalid && <span>{invalidText}</span>}
    </label>
  ),
  PasswordInput: ({
    labelText,
    id,
    helperText,
    showPasswordLabelText,
    hidePasswordLabelText,
    invalid,
    invalidText,
    ...props
  }: any) => (
    <label htmlFor={id}>
      {labelText}
      <input type="password" id={id} {...props} />
      {invalid && <span>{invalidText}</span>}
    </label>
  ),
}));

import AccountSecurity from "../../src/components/Account/AccountSecurity";
import ConfirmEmail from "../../src/components/Account/ConfirmEmail";
import { MemoryRouter } from "react-router-dom";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const buttons = (text: string) =>
  Array.from(container.querySelectorAll("button")).filter(
    (button) => button.textContent === text
  );
const button = (text: string) => buttons(text).at(-1)!;
const input = (label: string) =>
  Array.from(container.querySelectorAll("label"))
    .find((item) => item.textContent?.startsWith(label))!
    .querySelector("input")!;
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(node));
};
const click = async (element: HTMLElement) => {
  await act(async () => element.click());
};
const fill = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.data = {
    email: "old@example.com",
    hasPassword: true,
    canChangeEmail: true,
    providers: ["auth0"],
    connection: "database",
  };
  mocks.login.mockResolvedValue(undefined);
  mocks.claims.mockResolvedValue({
    sub: "auth0|owner",
    auth_time: Math.floor(Date.now() / 1000),
    __raw: "signed-proof",
  });
  mocks.update.mockReturnValue({
    unwrap: () => Promise.resolve({ success: true }),
  });
  mocks.confirm.mockReturnValue({
    unwrap: () => Promise.resolve({ success: true }),
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const open = async (label: string) => {
  await click(button(label));
  await click(button("Confirm your identity"));
};

it("changes email independently of the profile and keeps the old address visible", async () => {
  await render(<AccountSecurity account={{}} />);
  expect(container.querySelector("input")).toBeNull();
  await open("Change email");
  await fill(input("New email address"), "new@example.com");
  await click(button("Send confirmation link"));
  expect(mocks.update).toHaveBeenCalledWith({
    action: "email",
    method: "post",
    body: {
      email: "new@example.com",
      language: "en",
      reauthToken: "signed-proof",
    },
  });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).toContain("old@example.com");
  expect(mocks.reset).toHaveBeenCalled();
});

it("requires matching new passwords and sends the verified proof", async () => {
  await render(<AccountSecurity account={{}} />);
  await open("Change password");
  await fill(input("New password"), "a-long-new-password");
  await fill(input("Repeat new password"), "mismatch");
  expect(button("Change password").disabled).toBe(true);
  await fill(input("Repeat new password"), "a-long-new-password");
  await click(button("Change password"));
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "Your password has been changed."
  );
  expect(mocks.update).toHaveBeenCalledWith({
    action: "password",
    method: "post",
    body: { password: "a-long-new-password", reauthToken: "signed-proof" },
  });
});

it("supports password recovery without requiring the forgotten password", async () => {
  await render(<AccountSecurity account={{}} />);
  await click(button("Change password"));
  await click(button("Forgot password?"));
  expect(mocks.update).toHaveBeenCalledWith({
    action: "password/reset",
    body: undefined,
    method: "post",
  });
  expect(mocks.login).not.toHaveBeenCalled();
});

it.each(["not-an-email", "old@example.com", " OLD@example.com "])(
  "rejects an invalid or unchanged email address: %s",
  async (email) => {
    await render(<AccountSecurity account={{}} />);
    await open("Change email");
    expect(button("Send confirmation link").disabled).toBe(true);
    await fill(input("New email address"), email);
    expect(button("Send confirmation link").disabled).toBe(true);
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });
    expect(mocks.update).not.toHaveBeenCalled();
  }
);

it("submits a trimmed email address through the form", async () => {
  await render(<AccountSecurity account={{}} />);
  await open("Change email");
  expect(document.activeElement).toBe(input("New email address"));
  await fill(input("New email address"), " new@example.com ");
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
  });
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.objectContaining({ email: "new@example.com" }),
    })
  );
});

it.each([7, 129])("rejects a matching password of %i characters", async (length) => {
  await render(<AccountSecurity account={{}} />);
  await open("Change password");
  await fill(input("New password"), "a".repeat(length));
  await fill(input("Repeat new password"), "a".repeat(length));
  expect(button("Change password").disabled).toBe(true);
  await click(button("Change password"));
  expect(mocks.update).not.toHaveBeenCalled();
});

it("revalidates confirmation when the first password changes", async () => {
  await render(<AccountSecurity account={{}} />);
  await open("Change password");
  expect(document.activeElement).toBe(input("New password"));
  await fill(input("New password"), "a-long-new-password");
  await fill(input("Repeat new password"), "a-long-new-password");
  expect(button("Change password").disabled).toBe(false);
  await fill(input("New password"), "another-long-password");
  expect(button("Change password").disabled).toBe(true);
  expect(container.textContent).toContain("The passwords do not match.");
  await fill(input("New password"), "a-long-new-password");
  expect(button("Change password").disabled).toBe(false);
  expect(container.textContent).not.toContain("The passwords do not match.");
});

it("clears cancelled values and validates only the newly opened form", async () => {
  await render(<AccountSecurity account={{}} />);
  await open("Change password");
  await fill(input("New password"), "a-long-new-password");
  await fill(input("Repeat new password"), "mismatch");
  await click(button("Cancel"));
  await open("Change email");
  await fill(input("New email address"), "new@example.com");
  expect(button("Send confirmation link").disabled).toBe(false);
  await click(button("Cancel"));
  await open("Change password");
  expect(input("New password").value).toBe("");
  expect(input("Repeat new password").value).toBe("");
  expect(button("Change password").disabled).toBe(true);
});

it("clears fields and requires reauthentication after an expired proof", async () => {
  mocks.update.mockReturnValue({
    unwrap: () => Promise.reject({ status: 401 }),
  });
  await render(<AccountSecurity account={{}} />);
  await open("Change password");
  await fill(input("New password"), "a-long-new-password");
  await fill(input("Repeat new password"), "a-long-new-password");
  await click(button("Change password"));
  expect(container.querySelector("input")).toBeNull();
  await click(button("Confirm your identity"));
  expect(input("New password").value).toBe("");
  expect(input("Repeat new password").value).toBe("");
  expect(button("Change password").disabled).toBe(true);
});

it("shows pending status, cooldown and cancellation", async () => {
  mocks.data.pendingEmail = "new@example.com";
  mocks.data.resendAvailableAt = new Date(Date.now() + 60_000).toISOString();
  await render(<AccountSecurity account={{}} />);
  expect(container.textContent).toContain(
    "Confirmation pending for new@example.com"
  );
  expect(
    Array.from(container.querySelectorAll("button")).find((item) =>
      item.textContent?.startsWith("Resend in")
    )?.disabled
  ).toBe(true);
  await click(button("Cancel change"));
  expect(mocks.update).toHaveBeenCalledWith({
    action: "email",
    method: "delete",
    body: undefined,
  });
});

it.each(["apple", "google-oauth2"])(
  "shows provider management for %s accounts",
  async (provider) => {
    mocks.data = {
      ...mocks.data,
      providers: [provider],
      hasPassword: false,
      canChangeEmail: false,
    };
    await render(<AccountSecurity account={{}} />);
    expect(buttons("Change password")).toHaveLength(0);
    expect(buttons("Change email")).toHaveLength(0);
    expect(container.querySelector("a")?.href).toContain(
      provider === "apple" ? "apple.com" : "google.com"
    );
    expect(container.textContent).toContain("old@example.com");
  }
);

it("does not accept authentication for a different account", async () => {
  mocks.claims.mockResolvedValue({
    sub: "auth0|someone-else",
    auth_time: Math.floor(Date.now() / 1000),
    __raw: "wrong-proof",
  });
  await render(<AccountSecurity account={{}} />);
  await open("Change email");
  expect(container.querySelector('[role="alert"]')).toBeTruthy();
  expect(container.querySelector("input")).toBeNull();
  expect(mocks.update).not.toHaveBeenCalled();
});

it("shows server errors and keeps the email dialog open", async () => {
  mocks.update.mockReturnValue({
    unwrap: () =>
      Promise.reject({
        status: 409,
        data: { message: "This email address is already in use." },
      }),
  });
  await render(<AccountSecurity account={{}} />);
  await open("Change email");
  await fill(input("New email address"), "used@example.com");
  await click(button("Send confirmation link"));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "This email address is already in use."
  );
  expect(container.querySelector('[role="dialog"]')).toBeTruthy();
});

it("requires an explicit click to confirm a link and removes the secret from history", async () => {
  const token = "a".repeat(64);
  window.history.replaceState({}, "", `/confirm-email#token=${token}`);
  await render(
    <MemoryRouter>
      <ConfirmEmail />
    </MemoryRouter>
  );
  expect(window.location.hash).toBe("");
  expect(mocks.confirm).not.toHaveBeenCalled();
  await click(button("Confirm email address"));
  expect(mocks.confirm).toHaveBeenCalledWith(token);
  expect(container.querySelector('[role="status"]')).toBeTruthy();
});
