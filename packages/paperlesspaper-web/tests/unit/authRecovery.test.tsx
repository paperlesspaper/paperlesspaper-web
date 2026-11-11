// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { Router, Route, Switch } from "react-router-dom";
import { createBrowserHistory } from "history";

const mocks = vi.hoisted(() => ({
  auth: {} as any,
  getToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  callback: vi.fn(),
  native: false,
  platform: "web",
  open: vi.fn(),
  close: vi.fn(),
  listeners: {} as Record<string, (event?: any) => any>,
  removeListener: vi.fn(),
}));
vi.mock("@auth0/auth0-react", () => ({ useAuth0: () => mocks.auth }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
    getPlatform: () => mocks.platform,
  },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async (event, fn) => {
      mocks.listeners[event] = fn;
      return { remove: mocks.removeListener };
    }),
  },
}));
vi.mock("@capacitor/browser", () => ({
  Browser: {
    open: mocks.open,
    close: mocks.close,
    addListener: vi.fn(async (event, fn) => {
      mocks.listeners[event] = fn;
      return { remove: mocks.removeListener };
    }),
  },
}));
vi.mock("@capacitor/device", () => ({
  Device: { getId: async () => ({ identifier: "test" }) },
}));
vi.mock("@sentry/react", () => ({ setUser: vi.fn() }));
vi.mock("ducks/devicesNotificationsApi", () => ({
  devicesNotificationsApi: {
    useRemoveDeviceTokenMutation: () => [vi.fn()],
  },
}));
vi.mock("helpers/useAppUrlListener", () => ({ default: () => {} }));
vi.mock("components/ErrorOverlay", () => ({ default: () => null }));
vi.mock("components/AuthWrapper", () => ({
  default: ({ children }: any) => <div>{children}</div>,
  LoginWrapperTitle: ({ children }: any) => <h1>{children}</h1>,
}));
vi.mock("../../src/components/Login/LoginImage", () => ({
  default: () => null,
}));
vi.mock("../../src/components/Login/login.module.scss", () => ({
  default: {},
}));
vi.mock("translation/i18n", () => ({ default: { language: "en" } }));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => <>{children}</>,
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, kind, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  BlockNotification: ({ children }: any) => <div>{children}</div>,
  InlineLoading: () => <div>Inline loading</div>,
}));
vi.mock("@internetderdinge/web", async () => {
  const React = await import("react");
  const Context = React.createContext<any>(null);
  return {
    defaultLoadingWithResetText: {
      title: "Loading",
      message: "Please wait...",
    },
    hiddenLoadingWithResetState: { isVisible: false },
    LoadingWithResetProvider: ({ children }: any) => {
      const [state, setLoadingWithResetState] = React.useState<any>({});
      return (
        <Context.Provider value={{ setLoadingWithResetState }}>
          {state.isVisible && <div data-testid="loading">{state.title}</div>}
          {children}
        </Context.Provider>
      );
    },
    useLoadingWithResetContext: () => React.useContext(Context),
    useSyncLoadingWithResetState: ({
      isVisible,
      setLoadingWithResetState,
    }: any) => {
      React.useEffect(() => {
        setLoadingWithResetState({ isVisible, title: "Loading" });
      }, [isVisible, setLoadingWithResetState]);
    },
  };
});

import useAccount, { AccountProvider } from "../../src/helpers/useAccount";
import authDuck from "../../src/ducks/auth";
import Login from "../../src/components/Login";
import {
  LoadingWithResetProvider,
  PrivateRouteWithOrganization,
  PrivateRoute,
} from "../../src/components/AuthWrapper/AuthRouter";
import {
  AUTH_RECOVERY_KEY,
  AUTH_TIMEOUT_MS,
  NATIVE_LOGIN_TIMEOUT_MS,
  safeReturnTo,
} from "../../src/helpers/authRecovery";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Map<HTMLElement, ReturnType<typeof createRoot>>();
function cleanup() {
  act(() => {
    for (const [container, root] of roots) {
      root.unmount();
      container.remove();
    }
  });
  roots.clear();
}
function render(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.set(container, root);
  root.render(node);
  return { rerender: (next: React.ReactNode) => root.render(next) };
}
const byRole = (role: string, options: any = {}) =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      role === "button" ? "button" : `[role="${role}"]`
    )
  ).find((node) => !options.name || node.textContent === options.name) ?? null;
function required(element: HTMLElement | null, description: string) {
  if (!element)
    throw new Error(`Missing ${description}: ${document.body.textContent}`);
  return element;
}
const screen = {
  getByText: (text: string) =>
    required(
      Array.from(document.querySelectorAll<HTMLElement>("body *")).find(
        (node) => node.textContent === text
      ) ?? null,
      text
    ),
  getByRole: (role: string, options?: any) =>
    required(byRole(role, options), role),
  queryByRole: byRole,
  queryByTestId: (id: string) =>
    document.querySelector(`[data-testid="${id}"]`),
};
const fireEvent = { click: (element: HTMLElement) => element.click() };

let account: ReturnType<typeof useAccount>;
let store: ReturnType<typeof configureStore>;
let history: ReturnType<typeof createBrowserHistory>;
let rerender: () => void;
const pending = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function Consumer() {
  account = useAccount();
  return null;
}
function Protected() {
  useAccount();
  return <div>Protected content</div>;
}
async function mount({
  path = "/workspace?view=frames#selected",
  strict = false,
  route = PrivateRouteWithOrganization,
} = {}) {
  window.history.replaceState({}, "", path);
  history = createBrowserHistory();
  store = configureStore({ reducer: { auth: authDuck.reducer } });
  const Private = route;
  const app = () => {
    const content = (
      <Provider store={store}>
        <AccountProvider>
          <Consumer />
          <Consumer />
          <Router history={history}>
            <LoadingWithResetProvider>
              <Switch>
                <Route path="/login" component={Login} />
                <Private path="/" component={Protected} />
              </Switch>
            </LoadingWithResetProvider>
          </Router>
        </AccountProvider>
      </Provider>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
  await act(async () => {
    const result = render(app());
    rerender = () => result.rerender(app());
  });
}
async function advance(ms = 501) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  for (const mock of [
    mocks.getToken,
    mocks.login,
    mocks.logout,
    mocks.callback,
    mocks.open,
    mocks.close,
  ])
    mock.mockReset();
  mocks.native = false;
  mocks.platform = "web";
  mocks.listeners = {};
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("saved-setting", "keep-me");
  mocks.getToken.mockResolvedValue("usable-token");
  mocks.logout.mockImplementation(async () => {
    mocks.auth = {
      ...mocks.auth,
      isAuthenticated: false,
      user: undefined,
      error: undefined,
    };
  });
  mocks.login.mockResolvedValue(undefined);
  mocks.callback.mockImplementation(async () => {
    mocks.auth = {
      ...mocks.auth,
      isAuthenticated: true,
      user: { sub: "user" },
      error: undefined,
    };
    return { appState: { returnTo: "/workspace" } };
  });
  mocks.auth = {
    isAuthenticated: true,
    isLoading: false,
    user: { sub: "user" },
    getAccessTokenSilently: mocks.getToken,
    loginWithRedirect: mocks.login,
    logout: mocks.logout,
    handleRedirectCallback: mocks.callback,
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it.each([false, true])(
  "shares one token request across consumers (StrictMode: %s)",
  async (strict) => {
    await mount({ strict });
    expect(mocks.getToken).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Protected content")).toBeTruthy();
    expect(screen.queryByTestId("loading")).toBeNull();
  }
);

it.each([
  "invalid_grant",
  "missing_refresh_token",
  "login_required",
  "consent_required",
  "interaction_required",
])(
  "recovers %s exactly once and preserves the destination and settings",
  async (error) => {
    mocks.getToken.mockRejectedValue({ error });
    await mount({ strict: true });
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.logout).toHaveBeenCalledWith({ openUrl: false });
    expect(mocks.login.mock.calls[0][0].appState.returnTo).toBe(
      "/workspace?view=frames#selected"
    );
    expect(localStorage.getItem("saved-setting")).toBe("keep-me");
    expect(sessionStorage.getItem(AUTH_RECOVERY_KEY)).toBe(
      "/workspace?view=frames#selected"
    );
  }
);

it("does not automatically redirect again after a failed recovery across a remount", async () => {
  sessionStorage.setItem(AUTH_RECOVERY_KEY, "/workspace");
  mocks.getToken.mockRejectedValue({ error: "invalid_grant" });
  await mount();
  expect(screen.getByRole("alert").textContent).toContain(
    "Login could not be completed"
  );
  expect(screen.queryByTestId("loading")).toBeNull();
  expect(mocks.login).not.toHaveBeenCalled();
  cleanup();
  await mount();
  expect(mocks.login).not.toHaveBeenCalled();
});

it("allows an explicit retry after a failed redirect without losing the destination", async () => {
  mocks.getToken.mockRejectedValue({ error: "invalid_grant" });
  mocks.login.mockRejectedValue(new Error("Auth0 unavailable"));
  await mount();
  expect(screen.getByRole("alert")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });
  expect(mocks.login).toHaveBeenCalledTimes(2);
  expect(mocks.login.mock.calls[1][0].appState.returnTo).toBe(
    "/workspace?view=frames#selected"
  );
  expect(screen.getByRole("alert")).toBeTruthy();
});

it("times out a redirect that resolves but never navigates", async () => {
  mocks.getToken.mockRejectedValue({ error: "invalid_grant" });
  await mount();
  await advance(AUTH_TIMEOUT_MS);
  expect(screen.queryByTestId("loading")).toBeNull();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  await advance(AUTH_TIMEOUT_MS * 2);
  expect(mocks.login).toHaveBeenCalledTimes(1);
});

it("times out a redirect promise that never resolves", async () => {
  mocks.getToken.mockRejectedValue({ error: "invalid_grant" });
  mocks.login.mockReturnValue(new Promise(() => {}));
  await mount();
  await advance(AUTH_TIMEOUT_MS);
  expect(screen.getByRole("alert")).toBeTruthy();
});

it("keeps the session on network failure and can retry the token successfully", async () => {
  mocks.getToken.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await mount();
  expect(screen.getByRole("alert").textContent).toContain("Connection failed");
  expect(mocks.logout).not.toHaveBeenCalled();
  expect(mocks.login).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });
  expect(screen.getByText("Protected content")).toBeTruthy();
  expect(localStorage.getItem("saved-setting")).toBe("keep-me");
});

it("bounds a hanging token request and ignores its late result", async () => {
  const token = pending<string>();
  mocks.getToken.mockReturnValue(token.promise);
  await mount();
  await advance(AUTH_TIMEOUT_MS);
  expect(screen.getByRole("alert").textContent).toContain("Connection failed");
  await act(async () => {
    token.resolve("too-late");
  });
  expect((store.getState() as any).auth.token).toBeUndefined();
  expect(screen.getByRole("alert")).toBeTruthy();
});

it("deduplicates concurrent refresh requests", async () => {
  await mount();
  const token = pending<string>();
  mocks.getToken.mockReturnValue(token.promise);
  let first: Promise<void>, second: Promise<void>;
  await act(async () => {
    first = account.getToken();
    second = account.getToken();
  });
  expect(first!).toBe(second!);
  expect(mocks.getToken).toHaveBeenCalledTimes(2);
  await act(async () => {
    token.resolve("new-token");
    await first;
  });
});

it("does not restore a late token after logout", async () => {
  await mount();
  const token = pending<string>();
  mocks.getToken.mockReturnValue(token.promise);
  await act(async () => {
    void account.getToken();
    account.stopSession();
  });
  await act(async () => {
    token.resolve("too-late");
  });
  expect((store.getState() as any).auth.token).toBeUndefined();
});

it("shows callback errors even when code remains in the login URL", async () => {
  mocks.auth = {
    ...mocks.auth,
    isAuthenticated: false,
    user: undefined,
    error: { error: "access_denied" },
  };
  await mount({ path: "/login?code=failed&state=test" });
  await advance();
  expect(screen.getByRole("alert").textContent).toContain(
    "Login could not be completed"
  );
  expect(screen.queryByTestId("loading")).toBeNull();
  expect(mocks.login).not.toHaveBeenCalled();
});

it("never automatically retries a rejected login callback", async () => {
  mocks.auth = {
    ...mocks.auth,
    isAuthenticated: false,
    error: { error: "login_required" },
  };
  await mount({ path: "/login?error=login_required&state=test" });
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(mocks.login).not.toHaveBeenCalled();
});

it("shows normal login actions to signed-out users and catches login failures", async () => {
  mocks.auth = { ...mocks.auth, isAuthenticated: false, user: undefined };
  await mount();
  await advance();
  expect(
    screen.getByRole("button", { name: "Login", exact: true })
  ).toBeTruthy();
  mocks.login.mockRejectedValue(new Error("offline"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Login", exact: true }));
  });
  expect(screen.getByRole("alert")).toBeTruthy();
});

it("shows an error when Auth0 initialization never finishes", async () => {
  mocks.auth = { ...mocks.auth, isLoading: true, isAuthenticated: false };
  await mount();
  await advance(AUTH_TIMEOUT_MS);
  expect(screen.getByRole("alert").textContent).toContain("Connection failed");
  expect(account.authProblem?.retry).toBe("reload");
});

it("clears the recovery guard only after obtaining a usable token", async () => {
  sessionStorage.setItem(AUTH_RECOVERY_KEY, "/workspace");
  await mount();
  expect(sessionStorage.getItem(AUTH_RECOVERY_KEY)).toBeNull();
});

it("leaves print-token rendering independent of Auth0", async () => {
  localStorage.setItem("print-token", "render-token");
  mocks.auth = {
    ...mocks.auth,
    isLoading: true,
    isAuthenticated: false,
    error: new Error("offline"),
  };
  await mount();
  expect(screen.getByText("Protected content")).toBeTruthy();
  expect(mocks.getToken).not.toHaveBeenCalled();
  expect(mocks.login).not.toHaveBeenCalled();
});

it("also shows failures on the other protected route variant", async () => {
  mocks.getToken.mockRejectedValue(new Error("offline"));
  await mount({ route: PrivateRoute });
  expect(screen.getByRole("alert")).toBeTruthy();
});

it("recovers an invalid session discovered during Auth0 initialization", async () => {
  mocks.auth = {
    ...mocks.auth,
    isAuthenticated: false,
    error: { error: "invalid_grant" },
  };
  await mount();
  expect(mocks.login).toHaveBeenCalledTimes(1);
});

it("keeps initialization network failures recoverable without logging out", async () => {
  mocks.auth = {
    ...mocks.auth,
    isAuthenticated: false,
    error: new TypeError("Failed to fetch"),
  };
  await mount();
  expect(screen.getByRole("alert").textContent).toContain("Connection failed");
  expect(mocks.logout).not.toHaveBeenCalled();
});

it("offers manual recovery when session storage is unavailable", async () => {
  const getItem = Storage.prototype.getItem;
  const storage = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(function (key) {
      if (this === sessionStorage) throw new Error("Storage disabled");
      return getItem.call(this, key);
    });
  try {
    mocks.getToken.mockRejectedValue({ error: "invalid_grant" });
    await mount();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  } finally {
    storage.mockRestore();
  }
});

it("treats a missing API token as a recoverable failure", async () => {
  mocks.getToken.mockResolvedValue(undefined);
  await mount();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByTestId("loading")).toBeNull();
});

it("keeps an existing API token during transient refresh errors", async () => {
  await mount();
  mocks.getToken.mockRejectedValue(new TypeError("Network error"));
  await act(async () => {
    await account.getToken();
  });
  expect((store.getState() as any).auth.token).toBe("usable-token");
  expect(mocks.logout).not.toHaveBeenCalled();
});

it("preserves the complete destination when a signed-out user chooses login", async () => {
  mocks.auth = { ...mocks.auth, isAuthenticated: false, user: undefined };
  await mount();
  await advance();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
  });
  expect(mocks.login.mock.calls[0][0].appState.returnTo).toBe(
    "/workspace?view=frames#selected"
  );
});

it("does not restore authentication from a callback after logout", async () => {
  await mount();
  const callback = pending<any>();
  mocks.callback.mockReturnValue(callback.promise);
  let completion: Promise<void>;
  await act(async () => {
    completion = account.handleRedirectCallback(
      "test://callback?code=test&state=test"
    );
    account.stopSession();
  });
  await act(async () => {
    callback.resolve({});
    await completion;
  });
  expect(mocks.getToken).toHaveBeenCalledTimes(1);
  expect((store.getState() as any).auth.token).toBeUndefined();
});

it("fetches a new callback token without waiting for an obsolete refresh", async () => {
  const previous = pending<string>();
  mocks.getToken.mockReturnValueOnce(previous.promise);
  await mount();
  await act(async () => {
    await account.handleRedirectCallback("test://callback?code=new&state=new");
  });
  expect((store.getState() as any).auth.token).toBe("usable-token");
  await act(async () => {
    previous.resolve("obsolete-token");
  });
  expect((store.getState() as any).auth.token).toBe("usable-token");
});

it("handles cancelled native logins and removes listeners on unmount", async () => {
  mocks.native = true;
  mocks.platform = "ios";
  mocks.getToken.mockRejectedValue({ error: "invalid_grant" });
  mocks.login.mockImplementation(async (options) => {
    await options.openUrl("https://auth.example/authorize");
  });
  await mount();
  expect(mocks.open).toHaveBeenCalledTimes(1);
  await act(async () => {
    mocks.listeners.browserFinished();
  });
  expect(screen.getByRole("alert")).toBeTruthy();
  cleanup();
  await act(async () => {});
  expect(mocks.removeListener).toHaveBeenCalledTimes(2);
});

it("completes a native login callback and clears its watchdog", async () => {
  vi.stubEnv("REACT_APP_IDENTIFIER_IOS", "de.paperlesspaper");
  mocks.native = true;
  mocks.platform = "ios";
  mocks.getToken.mockRejectedValueOnce({ error: "invalid_grant" });
  await mount();
  await act(async () => {
    await mocks.listeners.appUrlOpen({
      url: "de.paperlesspaper://auth.wirewire.de/capacitor/de.paperlesspaper/login?code=test&state=test",
    });
  });
  expect(screen.getByText("Protected content")).toBeTruthy();
  expect(mocks.callback).toHaveBeenCalledTimes(1);
  await advance(NATIVE_LOGIN_TIMEOUT_MS);
  expect(screen.queryByRole("alert")).toBeNull();
});

it.each([
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/login?code=x",
  "/logout",
])("rejects unsafe or recursive return destination %s", (path) => {
  expect(safeReturnTo(path)).toBe("/");
});
