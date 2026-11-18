import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  devices: vi.fn(),
  status: vi.fn(),
  members: vi.fn(),
  account: vi.fn(),
  notification: vi.fn(),
  preferences: vi.fn(),
  preference: vi.fn(),
  sendEmail: vi.fn(),
  push: vi.fn(),
  capture: vi.fn(),
  claim: vi.fn(),
  config: { env: "production" },
}));
vi.mock("@internetderdinge/api", () => ({
  devicesService: { getAllDevices: m.devices },
  iotDevicesService: { getDeviceStatus: m.status },
  usersService: { getUsersByOrganization: m.members },
  accountsService: { getAccountById: m.account },
  devicesNotificationsService: { getByUser: m.notification },
  config: m.config,
  i18n: { t: vi.fn() },
}));
vi.mock("@sentry/node", () => ({ captureException: m.capture }));
vi.mock("../../src/batteryNotifications/batteryNotifications.model.js", () => ({
  BatteryPreference: {
    find: () => ({ lean: m.preferences }),
    findById: () => ({ lean: m.preference }),
  },
}));
vi.mock("../../src/batteryNotifications/batteryDelivery.service.js", () => ({
  deliverBatteryOnce: m.claim,
}));
vi.mock("../../src/utils/transactionalEmail.js", () => ({
  sendTransactionalEmail: m.sendEmail,
}));
vi.mock("../../src/cronjobs/notifications.push.js", () => ({
  sendPushNotification: m.push,
}));
import { cronjobBattery } from "../../src/cronjobs/battery.cronjob.js";
const device = {
  _id: "device",
  deviceId: "epd-device",
  kind: "epd7",
  organization: "org",
  meta: { name: "Kitchen" },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.config.env = "production";
  m.devices.mockResolvedValue([device]);
  m.status.mockResolvedValue({
    batLevel: "4250",
    lastReachableAgo: Date.now(),
    usbConnected: false,
  });
  m.members.mockResolvedValue([{ _id: "member", owner: "auth0|user" }]);
  m.preferences.mockResolvedValue([
    {
      _id: "auth0|user",
      low: { email: true, push: true },
      empty: { email: false, push: false },
    },
  ]);
  m.preference.mockResolvedValue({
    low: { email: true, push: true },
    empty: { email: false, push: false },
  });
  m.account.mockResolvedValue({
    email: "test@example.invalid",
    app_metadata: { language: "de" },
  });
  m.notification.mockResolvedValue({ tokens: [{ token: "mock-token" }] });
  m.push.mockResolvedValue(["mock-message-id"]);
  m.claim.mockImplementation(async (_identity, send) => send());
});
it("delivers independent opted-in email and push with localized content and device links", async () => {
  expect(await cronjobBattery()).toEqual({
    checked: 1,
    low: 1,
    empty: 0,
    sent: 2,
    errors: 0,
  });
  expect(m.sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      email: "test@example.invalid",
      title: "Kitchen: Batterie fast leer",
      url: "https://web.paperlesspaper.de/org/devices/device",
    })
  );
  expect(m.push).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "/org/devices/device",
      deviceNotifications: expect.objectContaining({
        settings: { battery: { push: true, email: false } },
      }),
    })
  );
});
it("supports email-only users without a push registration", async () => {
  m.notification.mockResolvedValue(null);
  expect((await cronjobBattery()).sent).toBe(1);
  expect(m.sendEmail).toHaveBeenCalledOnce();
  expect(m.push).not.toHaveBeenCalled();
});
it("does not notify anyone by default", async () => {
  m.preferences.mockResolvedValue([]);
  await cronjobBattery();
  expect(m.devices).not.toHaveBeenCalled();
});
it("respects a preference changed during the job", async () => {
  m.preference.mockResolvedValue({
    low: { email: false, push: false },
    empty: { email: false, push: false },
  });
  expect((await cronjobBattery()).sent).toBe(0);
  expect(m.sendEmail).not.toHaveBeenCalled();
  expect(m.push).not.toHaveBeenCalled();
});
it("retains push delivery when email fails and reports the failure", async () => {
  m.sendEmail.mockRejectedValue(new Error("SES unavailable"));
  expect(await cronjobBattery()).toEqual({
    checked: 1,
    low: 1,
    empty: 0,
    sent: 1,
    errors: 1,
  });
  expect(m.push).toHaveBeenCalledOnce();
});
it("skips bounced email addresses", async () => {
  m.notification.mockResolvedValue({
    tokens: [],
    bounceEmail: "test@example.invalid",
  });
  expect((await cronjobBattery()).sent).toBe(0);
  expect(m.sendEmail).not.toHaveBeenCalled();
});
it.each([
  { usbConnected: true },
  { lastReachableAgo: Date.now() - 3 * 60 * 60_000, sleepTime: 3600 },
  { batLevel: 4470 },
  { batLevel: null },
])("ignores USB, stale and non-low telemetry: %j", async (overrides) => {
  m.status.mockResolvedValue({
    batLevel: 4250,
    lastReachableAgo: Date.now(),
    ...overrides,
  });
  expect((await cronjobBattery()).low).toBe(0);
  expect(m.claim).not.toHaveBeenCalled();
});
it("continues with other devices when telemetry fails", async () => {
  m.devices.mockResolvedValue([
    device,
    { ...device, _id: "second", deviceId: "epd-second" },
  ]);
  m.status.mockRejectedValueOnce(new Error("IoT unavailable"));
  expect(await cronjobBattery()).toEqual({
    checked: 1,
    low: 1,
    empty: 0,
    sent: 2,
    errors: 1,
  });
});
it("honors organization scope and supported device kinds", async () => {
  m.devices.mockResolvedValue([
    device,
    { ...device, organization: "other" },
    { ...device, kind: "memo" },
  ]);
  await cronjobBattery({ organization: "org" });
  expect(m.status).toHaveBeenCalledOnce();
});
it("deduplicates memberships and excludes unaccepted invitations and onlyself members", async () => {
  m.members.mockResolvedValue([
    { owner: "auth0|user" },
    { owner: "auth0|user" },
    { owner: undefined },
    { owner: "auth0|restricted", role: "onlyself" },
  ]);
  expect((await cronjobBattery()).sent).toBe(2);
});
it("does not deliver to nonmembers", async () => {
  m.members.mockResolvedValue([{ owner: "auth0|different" }]);
  expect((await cronjobBattery()).sent).toBe(0);
  expect(m.status).not.toHaveBeenCalled();
});
it("does not send while a prior delivery is suppressed by the receipt", async () => {
  m.claim.mockResolvedValue(false);
  expect((await cronjobBattery()).sent).toBe(0);
  expect(m.sendEmail).not.toHaveBeenCalled();
});
it("does not run deliveries outside production", async () => {
  m.config.env = "development";
  expect((await cronjobBattery()).skipped).toBe("non-production");
  expect(m.preferences).not.toHaveBeenCalled();
  expect(m.sendEmail).not.toHaveBeenCalled();
});

it("reports a failed push channel without losing a successful email", async () => {
  m.push.mockResolvedValue([]);
  expect(await cronjobBattery()).toEqual({
    checked: 1,
    low: 1,
    empty: 0,
    sent: 1,
    errors: 1,
  });
});

it("does not expose another device to an opted-in onlyself member", async () => {
  m.members.mockResolvedValue([
    { _id: "restricted-member", owner: "auth0|user", role: "onlyself" },
  ]);
  expect((await cronjobBattery()).sent).toBe(0);
  expect(m.status).not.toHaveBeenCalled();
  m.devices.mockResolvedValue([{ ...device, user: "restricted-member" }]);
  expect((await cronjobBattery()).sent).toBe(2);
});

it("sends only the opted-in no-contact channels, even with old USB or full battery readings", async () => {
  m.status.mockResolvedValue({
    batLevel: 6000,
    usbConnected: true,
    lastReachableAgo: Date.now() - 86_400_001,
  });
  m.preference.mockResolvedValue({
    low: { email: false, push: true },
    empty: { email: true, push: false },
  });
  expect(await cronjobBattery()).toEqual({
    checked: 1,
    low: 0,
    empty: 1,
    sent: 1,
    errors: 0,
  });
  expect(m.sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Kitchen: Batterie leer",
      body: expect.stringContaining("mehr als einem Tag"),
    })
  );
  expect(m.push).not.toHaveBeenCalled();
  expect(m.claim).toHaveBeenCalledWith(
    expect.objectContaining({ warning: "empty" }),
    expect.any(Function)
  );
});
it("does not reuse a low-battery opt-in for the new no-contact warning", async () => {
  m.status.mockResolvedValue({ lastReachableAgo: Date.now() - 2 * 86_400_000 });
  m.preference.mockResolvedValue({ email: true, push: true });
  expect((await cronjobBattery()).sent).toBe(0);
  expect(m.sendEmail).not.toHaveBeenCalled();
  expect(m.push).not.toHaveBeenCalled();
});
it("does not infer an empty battery from a telemetry lookup failure", async () => {
  m.status.mockResolvedValue(null);
  expect(await cronjobBattery()).toEqual({
    checked: 1,
    low: 0,
    empty: 0,
    sent: 0,
    errors: 0,
  });
  expect(m.claim).not.toHaveBeenCalled();
});
