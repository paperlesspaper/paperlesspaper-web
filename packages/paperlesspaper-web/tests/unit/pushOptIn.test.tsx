// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import usePushNotificationsPwa from "../../src/helpers/notifications/usePushPwa";
import { PUSH_OPT_IN_KEY } from "../../src/helpers/notifications/pushSubscription";

const mocks = vi.hoisted(() => ({
  account: { user: { sub: "account-a" }, reduxToken: "auth-token" },
  save: vi.fn(),
  remove: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  firebaseLoaded: vi.fn(),
}));
vi.mock("helpers/useAccount", () => ({ default: () => mocks.account }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" } }));
vi.mock("@capacitor/device", () => ({
  Device: { getId: async () => ({ identifier: "browser-id" }) },
}));
vi.mock("ducks/devicesNotificationsApi", () => ({
  devicesNotificationsApi: {
    useSetDeviceTokenMutation: () => [
      (...args: unknown[]) => ({ unwrap: () => mocks.save(...args) }),
    ],
    useRemoveDeviceTokenMutation: () => [
      (...args: unknown[]) => ({ unwrap: () => mocks.remove(...args) }),
    ],
  },
}));
vi.mock("../../src/helpers/firebase", () => {
  mocks.firebaseLoaded();
  return {
    registerWebPush: mocks.register,
    unregisterWebPush: mocks.unregister,
  };
});

const requestPermission = vi.fn();
const getRegistrations = vi.fn();
const roots: ReturnType<typeof createRoot>[] = [];
function renderHook(
  hook: typeof usePushNotificationsPwa,
  options?: { wrapper: typeof StrictMode },
) {
  const root = createRoot(document.createElement("div"));
  roots.push(root);
  const result = { current: null as ReturnType<typeof hook> };
  function Probe() {
    result.current = hook();
    return null;
  }
  const rerender = () =>
    act(() =>
      root.render(
        options?.wrapper ? (
          <StrictMode>
            <Probe />
          </StrictMode>
        ) : (
          <Probe />
        ),
      ),
    );
  rerender();
  return { result, rerender };
}
async function waitFor(assertion: () => void) {
  for (let i = 0; i < 100; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    try {
      assertion();
      return;
    } catch (error) {
      if (i === 99) throw error;
    }
  }
}
const settle = async (result: {
  current: ReturnType<typeof usePushNotificationsPwa>;
}) => {
  await waitFor(() => expect(result.current.busy).toBe(false));
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  localStorage.clear();
  mocks.account = { user: { sub: "account-a" }, reduxToken: "auth-token" };
  mocks.register.mockResolvedValue("fcm-token");
  mocks.unregister.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  requestPermission.mockResolvedValue("granted");
  getRegistrations.mockResolvedValue([]);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "granted", requestPermission });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistrations },
  });
});
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  vi.unstubAllGlobals();
});

describe("push opt-in", () => {
  it("does not load Firebase, prompt or acquire tokens on mount/login, even with granted browser permission", async () => {
    mocks.account.reduxToken = "";
    const { result, rerender } = renderHook(usePushNotificationsPwa, {
      wrapper: StrictMode,
    });
    await settle(result);
    mocks.account.reduxToken = "auth-token";
    rerender();
    await settle(result);
    expect(mocks.firebaseLoaded).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
  });

  it("requests permission synchronously and registers once after a deliberate activation", async () => {
    const { result, rerender } = renderHook(usePushNotificationsPwa);
    await settle(result);
    await act(async () => {
      const first = result.current.enableNotifications();
      expect(requestPermission).toHaveBeenCalledTimes(1);
      await result.current.enableNotifications();
      await first;
    });
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith({
      values: expect.objectContaining({
        token: "fcm-token",
        deviceId: "browser-id",
      }),
    });
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBe("account-a");
    expect(result.current.enabled).toBe(true);
    mocks.account = { ...mocks.account, reduxToken: "refreshed-auth-token" };
    rerender();
    await settle(result);
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });

  it("does not initialize push after permission is denied or dismissed", async () => {
    requestPermission.mockResolvedValue("default");
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    await act(() => result.current.enableNotifications());
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBeNull();
    expect(result.current.error).toBe("permission");
  });

  it("restores only this account's opt-in without prompting", async () => {
    localStorage.setItem(PUSH_OPT_IN_KEY, "account-a");
    const { result } = renderHook(usePushNotificationsPwa, {
      wrapper: StrictMode,
    });
    await settle(result);
    expect(result.current.enabled).toBe(true);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("does not inherit another account's opt-in", async () => {
    localStorage.setItem(PUSH_OPT_IN_KEY, "account-b");
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBeNull();
  });

  it("does not restore revoked browser permissions", async () => {
    localStorage.setItem(PUSH_OPT_IN_KEY, "account-a");
    Object.defineProperty(Notification, "permission", {
      value: "denied",
      configurable: true,
    });
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBeNull();
  });

  it("rolls back a subscription when saving the token fails", async () => {
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    mocks.save.mockRejectedValueOnce(new Error("offline"));
    await act(() => result.current.enableNotifications());
    expect(result.current.error).toBe("registration");
    expect(result.current.enabled).toBe(false);
    expect(mocks.unregister).toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBeNull();
  });

  it("clears consent on disable and allows failed cleanup to be retried", async () => {
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    await act(() => result.current.enableNotifications());
    mocks.remove.mockRejectedValueOnce(new Error("offline"));
    await act(() => result.current.disableNotifications());
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBeNull();
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBe("cleanup");
    await act(() => result.current.disableNotifications());
    expect(result.current.error).toBeNull();
    expect(mocks.unregister).toHaveBeenCalled();
  });

  it("removes only legacy Firebase workers and their subscriptions", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const unregister = vi.fn().mockResolvedValue(true);
    const unrelated = vi.fn();
    getRegistrations.mockResolvedValue([
      {
        active: { scriptURL: "https://example.com/firebase-messaging-sw.js" },
        pushManager: { getSubscription: async () => ({ unsubscribe }) },
        unregister,
      },
      {
        active: { scriptURL: "https://example.com/service-worker.js" },
        unregister: unrelated,
      },
    ]);
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(unrelated).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("discards registration that finishes after an account switch", async () => {
    let finish: (token: string) => void;
    mocks.register.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(usePushNotificationsPwa);
    await settle(result);
    let activation: Promise<void>;
    act(() => {
      activation = result.current.enableNotifications();
    });
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    mocks.account = { ...mocks.account, user: { sub: "account-b" } };
    rerender();
    await act(async () => {
      finish("stale-token");
      await activation;
    });
    await settle(result);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_OPT_IN_KEY)).toBeNull();
    expect(result.current.enabled).toBe(false);
  });

  it("honors opt-out in another browser tab", async () => {
    localStorage.setItem(PUSH_OPT_IN_KEY, "account-a");
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    act(() => {
      localStorage.removeItem(PUSH_OPT_IN_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: PUSH_OPT_IN_KEY, newValue: null }),
      );
    });
    await settle(result);
    expect(result.current.enabled).toBe(false);
    expect(mocks.unregister).toHaveBeenCalled();
  });

  it("does not request permission on unsupported browsers", async () => {
    vi.stubGlobal("isSecureContext", false);
    const { result } = renderHook(usePushNotificationsPwa);
    await settle(result);
    await act(() => result.current.enableNotifications());
    expect(result.current.supported).toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
