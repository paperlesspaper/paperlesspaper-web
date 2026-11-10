// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWebPush, unregisterWebPush } from "../../src/helpers/firebase";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  deleteApp: vi.fn(),
  getApps: vi.fn(),
  getMessaging: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  isSupported: vi.fn(),
}));
vi.mock("firebase/app", () => mocks);
vi.mock("firebase/messaging", () => mocks);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Notification", { permission: "granted" });
  mocks.getApps.mockReturnValue([]);
  mocks.initializeApp.mockImplementation(() => ({
    name: "paperlesspaper-push",
  }));
  mocks.getMessaging.mockImplementation((app) => ({ app }));
  mocks.getToken.mockResolvedValue("token");
  mocks.isSupported.mockResolvedValue(true);
});
afterEach(async () => {
  await unregisterWebPush();
  vi.unstubAllGlobals();
});

describe("Firebase push lifecycle", () => {
  it("does not initialize Firebase on cleanup or without permission", async () => {
    await unregisterWebPush();
    vi.stubGlobal("Notification", { permission: "denied" });
    await expect(registerWebPush()).rejects.toThrow();
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.deleteToken).not.toHaveBeenCalled();
  });

  it("does not register a worker through deleteToken after a failed registration", async () => {
    mocks.getToken.mockRejectedValueOnce(
      new Error("Worker registration failed"),
    );
    await expect(registerWebPush()).rejects.toThrow();
    await unregisterWebPush();
    expect(mocks.deleteToken).not.toHaveBeenCalled();
    expect(mocks.deleteApp).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh Messaging instance when push is enabled again", async () => {
    await registerWebPush();
    const firstMessaging = mocks.getToken.mock.calls[0][0];
    await unregisterWebPush();
    expect(mocks.deleteToken).toHaveBeenCalledWith(firstMessaging);
    await registerWebPush();
    const secondMessaging = mocks.getToken.mock.calls[1][0];
    expect(secondMessaging).not.toBe(firstMessaging);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(2);
  });
});
