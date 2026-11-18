import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  send: vi.fn(),
  mail: vi.fn(),
  account: vi.fn(),
  capture: vi.fn(),
  config: { env: "production" },
}));
vi.mock("firebase-admin", () => ({
  default: { apps: [{}], credential: { cert: vi.fn() } },
}));
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ send: m.send }),
}));
vi.mock("node:fs", () => ({ default: { existsSync: () => false } }));
vi.mock("@sentry/node", () => ({ captureException: m.capture }));
vi.mock("@internetderdinge/api", () => ({
  config: m.config,
  accountsService: { getAccountById: m.account },
  sendEmail: m.mail,
}));
import { sendPushNotification } from "../../src/cronjobs/notifications.push";
beforeEach(() => {
  vi.resetAllMocks();
  m.account.mockResolvedValue({ email: "test@example.invalid" });
  m.send.mockResolvedValue("message-id");
});
const input = {
  user: "auth0|user",
  kind: "battery",
  urgent: false,
  deviceNotifications: {
    user: "auth0|user",
    tokens: [] as { token: string }[],
    settings: { battery: { email: true, push: false } },
  },
};
it("does not gate email-only delivery on push token registration", async () => {
  await sendPushNotification(input);
  expect(m.mail).toHaveBeenCalledWith(
    expect.objectContaining({ email: "test@example.invalid" })
  );
  expect(m.send).not.toHaveBeenCalled();
});
it("honors email opt-out and reports only successful push deliveries", async () => {
  const result = await sendPushNotification({
    ...input,
    deviceNotifications: {
      ...input.deviceNotifications,
      tokens: [{ token: "ok" }, { token: "bad" }],
      settings: { battery: { email: false, push: true } },
    },
  });
  expect(result).toHaveLength(2);
  expect(m.mail).not.toHaveBeenCalled();
  m.send.mockRejectedValue(new Error("expired token"));
  expect(
    await sendPushNotification({
      ...input,
      deviceNotifications: {
        ...input.deviceNotifications,
        tokens: [{ token: "bad" }],
        settings: { battery: { email: false, push: true } },
      },
    })
  ).toEqual([]);
  expect(m.capture).toHaveBeenCalledOnce();
});
it("suppresses bounced email and supports Auth0 responses wrapped in data", async () => {
  m.account.mockResolvedValue({ data: { email: "test@example.invalid" } });
  await sendPushNotification({
    ...input,
    deviceNotifications: {
      ...input.deviceNotifications,
      bounceEmail: "test@example.invalid",
    },
  });
  expect(m.mail).not.toHaveBeenCalled();
});
