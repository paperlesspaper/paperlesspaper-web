import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativePush } from "../../src/helpers/notifications/nativePush";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  remove: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  getToken: vi.fn(),
  deleteInstance: vi.fn(),
  setAutoInit: vi.fn(),
}));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    addListener: async (
      event: string,
      callback: (...args: unknown[]) => void,
    ) => {
      mocks.listeners.set(event, callback);
      return { remove: mocks.remove };
    },
    register: mocks.register,
    unregister: mocks.unregister,
    requestPermissions: async () => ({ receive: "denied" }),
    checkPermissions: async () => ({ receive: "granted" }),
  },
}));
vi.mock("@capacitor-community/fcm", () => ({ FCM: mocks }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.getToken.mockResolvedValue({ token: "native-token" });
  mocks.register.mockImplementation(async () => {
    expect(mocks.listeners.has("registrationError")).toBe(true);
    mocks.listeners.get("registration")?.({ value: "apns-token" });
  });
});

describe("native push", () => {
  it("does not fetch tokens when checking or requesting permission", async () => {
    expect(await nativePush.permission()).toBe(true);
    expect(await nativePush.requestPermission()).toBe(false);
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("waits for native registration before fetching FCM and removes listeners", async () => {
    expect(await nativePush.register()).toBe("native-token");
    expect(mocks.setAutoInit).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.getToken).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });

  it("cleans up listeners when native registration fails", async () => {
    mocks.register.mockImplementationOnce(async () => {
      mocks.listeners.get("registrationError")?.(new Error("APNs error"));
    });
    await expect(nativePush.register()).rejects.toThrow("APNs error");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });

  it("attempts both native cleanups without requesting a token", async () => {
    mocks.unregister.mockRejectedValueOnce(new Error("offline"));
    await expect(nativePush.unregister()).rejects.toThrow();
    expect(mocks.deleteInstance).toHaveBeenCalledTimes(1);
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
});
