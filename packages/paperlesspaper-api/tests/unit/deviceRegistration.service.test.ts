import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  createDevice: vi.fn(),
  deleteOne: vi.fn(),
  updatePapers: vi.fn(),
  resetCache: vi.fn(),
  activateDevice: vi.fn(),
}));
vi.mock("@internetderdinge/api", () => ({
  ApiError: class extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
  Device: class {
    constructor() {
      mocks.createDevice();
      throw new Error("Unexpected device creation without ownership proof");
    }
    static findOne = mocks.findOne;
    static deleteOne = mocks.deleteOne;
  },
  iotDevicesService: { activateDevice: mocks.activateDevice },
  usersService: {},
}));
vi.mock("../../src/papers/papers.model.js", () => ({
  default: { updateMany: mocks.updatePapers },
}));
vi.mock("../../src/iotdevice/deviceImageCache.js", () => ({
  resetDeviceImageCache: mocks.resetCache,
}));

import {
  getRegistrationStatus,
  registerDevice,
} from "../../src/devices/deviceRegistration.service.js";

const deviceId = "epd7-test";
const organization = "org-b";
const legacyStatus = {
  success: true,
  organizationName: organization,
  type: "epaper",
  lastReachableAgo: 1,
  message:
    'Device activation flag is false. Only Data is returned. To start activation set "enable":true',
};
const pending = { success: true, activation_status: "pending" };
let expectedCacheResets = 0;

beforeEach(() => {
  expectedCacheResets = 0;
  vi.resetAllMocks();
  mocks.findOne.mockResolvedValue(null);
  mocks.activateDevice.mockResolvedValue(legacyStatus);
});
afterEach(() => {
  expect(mocks.createDevice).not.toHaveBeenCalled();
  expect(mocks.deleteOne).not.toHaveBeenCalled();
  expect(mocks.updatePapers).not.toHaveBeenCalled();
  expect(mocks.resetCache).toHaveBeenCalledTimes(expectedCacheResets);
});

it.each([
  [null, "activation"],
  [{ organization }, "activation"],
  [{ organization: "org-a" }, "takeover"],
])(
  "allows legacy preflight without changing assignment %j",
  async (device, mode) => {
    mocks.findOne.mockResolvedValue(device);
    await expect(
      getRegistrationStatus(deviceId, organization)
    ).resolves.toEqual({
      available: true,
      mode,
    });
    expect(mocks.activateDevice).toHaveBeenCalledExactlyOnceWith(
      deviceId,
      organization,
      false
    );
  }
);

it("starts activation after the legacy read, without resetting or detaching an existing owner", async () => {
  mocks.findOne.mockResolvedValue({ _id: "old-device", organization: "org-a" });
  mocks.activateDevice
    .mockResolvedValueOnce(legacyStatus)
    .mockResolvedValueOnce(pending);
  await expect(
    registerDevice(deviceId, { organization, enable: true })
  ).resolves.toMatchObject({
    activation_status: "pending",
    registrationCompleted: false,
  });
  expect(mocks.activateDevice.mock.calls).toEqual([
    [deviceId, organization, false],
    [deviceId, organization, true],
  ]);
});

it("never turns a status-only legacy poll into ownership proof or starts activation", async () => {
  await expect(
    registerDevice(deviceId, { organization, enable: false })
  ).resolves.toEqual({
    activation_status: "unclaimed",
    registrationCompleted: false,
    type: "epaper",
    lastReachableAgo: 1,
  });
  expect(mocks.activateDevice).toHaveBeenCalledExactlyOnceWith(
    deviceId,
    organization,
    false
  );
});

it.each([
  undefined,
  null,
  { success: true },
  { ...legacyStatus, success: false },
  { ...legacyStatus, success: undefined },
  { ...legacyStatus, activation_status: null },
  { ...legacyStatus, activation_status: "" },
  { ...legacyStatus, key: "unexpected-key" },
  { ...legacyStatus, type: "other" },
  { ...legacyStatus, organizationName: "org-a" },
  { ...legacyStatus, organizationName: undefined },
  { ...legacyStatus, message: "Unexpected upstream response" },
])(
  "still rejects incomplete or unexpected status responses: %j",
  async (response) => {
    mocks.activateDevice.mockResolvedValue(response);
    await expect(
      getRegistrationStatus(deviceId, organization)
    ).rejects.toMatchObject({ statusCode: 502 });
    await expect(
      registerDevice(deviceId, { organization, enable: true })
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(mocks.activateDevice.mock.calls.map((call) => call[2])).toEqual([
      false,
      false,
    ]);
  }
);

it("does not apply the workaround to other device families", async () => {
  await expect(
    getRegistrationStatus("other-test", organization)
  ).rejects.toMatchObject({ statusCode: 502 });
});

it("does not accept the legacy response as an activation-start acknowledgement", async () => {
  await expect(
    registerDevice(deviceId, { organization, enable: true })
  ).rejects.toMatchObject({ statusCode: 502 });
  expect(mocks.activateDevice.mock.calls).toEqual([
    [deviceId, organization, false],
    [deviceId, organization, true],
  ]);
});

it("still reports upstream transport failures as 502 without starting activation", async () => {
  mocks.activateDevice.mockRejectedValue(new Error("IoT unavailable"));
  await expect(
    registerDevice(deviceId, { organization, enable: true })
  ).rejects.toMatchObject({ statusCode: 502 });
  expect(mocks.activateDevice).toHaveBeenCalledExactlyOnceWith(
    deviceId,
    organization,
    false
  );
});

it("accepts the documented unclaimed state after the upstream fix", async () => {
  mocks.activateDevice
    .mockResolvedValueOnce({ success: true, activation_status: "unclaimed" })
    .mockResolvedValueOnce({ success: true, activation_status: "unclaimed" })
    .mockResolvedValueOnce(pending);
  await expect(getRegistrationStatus(deviceId, organization)).resolves.toEqual({
    available: true,
    mode: "activation",
  });
  await expect(
    registerDevice(deviceId, { organization, enable: true })
  ).resolves.toMatchObject({
    activation_status: "pending",
    registrationCompleted: false,
  });
});

it("still requires a key for completed registration", async () => {
  mocks.activateDevice.mockResolvedValue({
    success: true,
    activation_status: "success",
  });
  await expect(
    registerDevice(deviceId, { organization, enable: false })
  ).resolves.toMatchObject({
    activation_status: "timeout",
    registrationCompleted: false,
  });
});

it("preserves confirmed registration and keeps the key server-side", async () => {
  expectedCacheResets = 1;
  const device = { _id: "registered-device", organization };
  mocks.findOne.mockResolvedValue(device);
  mocks.activateDevice.mockResolvedValue({
    success: true,
    activation_status: "success",
    key: "SECRET",
  });
  await expect(getRegistrationStatus(deviceId, organization)).resolves.toEqual({
    available: true,
    mode: "already_registered",
  });
  const result = await registerDevice(deviceId, { organization, enable: true });
  expect(result).toMatchObject({
    registrationCompleted: true,
    createdDevice: device,
  });
  expect(result).not.toHaveProperty("key");
  expect(mocks.resetCache).toHaveBeenCalledExactlyOnceWith(deviceId);
  expect(mocks.activateDevice.mock.calls.map((call) => call[2])).toEqual([
    false,
    false,
  ]);
});
