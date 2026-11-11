// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  popup: vi.fn(),
  claims: vi.fn(),
  update: vi.fn(),
  user: { sub: "auth0|owner" },
}));

// Exercise the installed SDK's real provider/reducer, mocking only its network
// client. A fixed isLoading:false mock misses the route unmount during login.
vi.mock("@auth0/auth0-spa-js", () => ({
  Auth0Client: class {
    checkSession = async () => {};
    getUser = async () => mocks.user;
    loginWithPopup = mocks.popup;
    getTokenWithPopup = mocks.popup;
    getIdTokenClaims = mocks.claims;
  },
}));
vi.mock("@auth0/auth0-react", async () => ({
  Auth0Provider: (await import("@auth0/auth0-react/src/auth0-provider"))
    .default,
  useAuth0: (await import("@auth0/auth0-react/src/use-auth0")).default,
}));
vi.mock("helpers/useAccount", async () => {
  const { useAuth0 } = await import("@auth0/auth0-react");
  return {
    default: () => ({
      ...useAuth0(),
      reduxToken: "existing-access-token",
      isDelayedLoading: false,
      authProblem: null,
    }),
  };
});
vi.mock("@internetderdinge/web", () => ({
  defaultLoadingWithResetText: {},
  useLoadingWithResetContext: () => ({ setLoadingWithResetState: vi.fn() }),
  useSyncLoadingWithResetState: vi.fn(),
}));
vi.mock("helpers/useAppUrlListener", () => ({ default: () => {} }));
vi.mock("components/ErrorOverlay", () => ({ default: () => null }));
vi.mock("components/AuthWrapper/AuthFailure", () => ({ default: () => null }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  Trans: ({ children }: any) => children,
}));
vi.mock("components/Mfa", () => ({ default: () => null }));
vi.mock("ducks/accounts", () => ({
  accountsApi: {
    useGetAccountSecurityQuery: () => ({
      data: {
        email: "old@example.com",
        canChangeEmail: true,
        hasPassword: true,
        providers: ["auth0"],
        connection: "database",
      },
    }),
    useUpdateAccountSecurityMutation: () => [
      mocks.update,
      { reset: vi.fn(), isLoading: false },
    ],
  },
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, kind, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  TextInput: ({
    labelText,
    helperText,
    invalid,
    invalidText,
    addonAfter,
    ...props
  }: any) => (
    <label>
      {labelText}
      <input {...props} />
    </label>
  ),
  Modal: ({
    children,
    modalHeading,
    primaryButtonText,
    primaryButtonDisabled,
    onRequestSubmit,
  }: any) => (
    <div role="dialog">
      <h2>{modalHeading}</h2>
      {children}
      <button disabled={primaryButtonDisabled} onClick={onRequestSubmit}>
        {primaryButtonText}
      </button>
    </div>
  ),
}));

import { Auth0Provider } from "@auth0/auth0-react";
import AccountSecurity from "../../src/components/Account/AccountSecurity";
import { PrivateRouteWithOrganization } from "../../src/components/AuthWrapper/AuthRouter";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent === text
  )!;
const click = async (text: string) => {
  await act(async () => button(text).click());
};
const mount = async () => {
  await act(async () =>
    root.render(
      <Auth0Provider domain="auth.example.com" clientId="test">
        <MemoryRouter initialEntries={["/account?organization=test"]}>
          <PrivateRouteWithOrganization
            path="/account"
            component={() => <AccountSecurity account={{}} />}
          />
        </MemoryRouter>
      </Auth0Provider>
    )
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__VERSION__", "test");
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.claims.mockResolvedValue({
    sub: mocks.user.sub,
    auth_time: Math.floor(Date.now() / 1000),
    __raw: "signed-proof",
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it.each([
  ["Change email", "security-new-email"],
  ["Change password", "security-new-password"],
])(
  "keeps %s mounted through the SDK popup and opens its input afterwards",
  async (action, inputId) => {
    let complete!: (token: string) => void;
    mocks.popup.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        })
    );
    await mount();
    await click(action);
    const dialog = container.querySelector('[role="dialog"]');
    await click("Confirm your identity");
    expect(container.querySelector('[role="dialog"]')).toBe(dialog);
    expect(mocks.popup).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationParams: expect.objectContaining({
          prompt: "login",
          max_age: 0,
        }),
      }),
      undefined
    );
    await act(async () => complete("fresh-access-token"));
    expect(container.querySelector('[role="dialog"]')).toBe(dialog);
    expect(container.querySelector(`#${inputId}`)).not.toBeNull();
    expect(mocks.popup).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  }
);

it("keeps cancellation local and lets the same dialog retry", async () => {
  mocks.popup.mockRejectedValueOnce(new Error("Popup closed"));
  await mount();
  await click("Change email");
  await click("Confirm your identity");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Sign-in was not completed"
  );
  expect(container.querySelector("input")).toBeNull();
  expect(mocks.claims).not.toHaveBeenCalled();
  mocks.popup.mockResolvedValueOnce("fresh-access-token");
  await click("Confirm your identity");
  expect(container.querySelector("#security-new-email")).not.toBeNull();
  expect(mocks.update).not.toHaveBeenCalled();
});

it.each([
  { sub: "auth0|different-user", auth_time: Math.floor(Date.now() / 1000) },
  { sub: "auth0|owner", auth_time: Math.floor(Date.now() / 1000) - 60 },
  { sub: "auth0|owner" },
])("does not unlock the form with invalid proof %j", async (claims) => {
  mocks.popup.mockResolvedValueOnce("fresh-access-token");
  mocks.claims.mockResolvedValueOnce({ ...claims, __raw: "invalid-proof" });
  await mount();
  await click("Change email");
  await click("Confirm your identity");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector("input")).toBeNull();
  expect(mocks.update).not.toHaveBeenCalled();
});
