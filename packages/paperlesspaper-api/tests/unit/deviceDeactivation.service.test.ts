import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  const state = {
    targetPaperIds: ["paper-a", "paper-b"],
  };
  const device = {
    _id: { toString: () => "device-object-id" },
    deviceId: "epd-test-device",
    kind: "epaper-13",
    organization: { toString: () => "organization-id" },
    updatedAt: new Date("2026-08-13T08:00:00.000Z"),
  };

  const makeQuery = (getValue: () => unknown) => {
    const query: any = {};
    query.select = vi.fn(() => query);
    query.lean = vi.fn(() => query);
    query.session = vi.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown, reject: unknown) =>
      Promise.resolve(getValue()).then(resolve, reject as any);
    return query;
  };

  const Device = {
    findOne: vi.fn(() => makeQuery(() => device)),
    deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
  };
  const Paper = {
    find: vi.fn(() =>
      makeQuery(() =>
        state.targetPaperIds.map((id) => ({
          _id: { toString: () => id },
        })),
      ),
    ),
    updateMany: vi.fn(async () => ({
      modifiedCount: state.targetPaperIds.length,
    })),
  };
  const iotDevicesService = {
    activateDevice: vi.fn(async () => ({ activation_status: "success" })),
    shadowAlarmUpdate: vi.fn(),
  };
  const session = {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn(async () => undefined),
  };

  return {
    ApiError,
    Device,
    Paper,
    device,
    iotDevicesService,
    session,
    startSession: vi.fn(async () => session),
    state,
  };
});

vi.mock("@internetderdinge/api", () => ({
  ApiError: mocks.ApiError,
  Device: mocks.Device,
  getSignedFileUrl: vi.fn(),
  iotDevicesService: mocks.iotDevicesService,
}));

vi.mock("mongoose", () => ({
  default: { startSession: mocks.startSession },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  HeadObjectCommand: class {},
  S3Client: class {
    send = vi.fn();
  },
}));

vi.mock("../../src/iotdevice/iotdevice.service", () => ({
  default: { uploadSingleImage: vi.fn() },
}));

vi.mock("../../src/papers/papers.model.js", () => ({
  default: mocks.Paper,
}));

import service from "../../src/devices/devices.service";

describe("device deactivation service", () => {
  beforeEach(() => {
    mocks.state.targetPaperIds = ["paper-a", "paper-b"];
    vi.clearAllMocks();
    mocks.session.withTransaction.mockImplementation(
      async (callback: () => Promise<void>) => callback(),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("previews and then atomically detaches papers from the device", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );

    expect(preview).toMatchObject({
      device: {
        id: "device-object-id",
        deviceId: mocks.device.deviceId,
        organizationId: "organization-id",
      },
      papersToDetach: {
        count: 2,
        ids: ["paper-a", "paper-b"],
      },
    });
    expect(preview.confirmationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.Paper.updateMany).not.toHaveBeenCalled();
    expect(mocks.Device.deleteOne).not.toHaveBeenCalled();
    expect(mocks.iotDevicesService.activateDevice).not.toHaveBeenCalled();

    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: mocks.device.deviceId,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.iotDevicesService.activateDevice).not.toHaveBeenCalled();

    const result = await service.deactivateDeviceByDeviceId({
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    });

    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledWith(
      mocks.device.deviceId,
      "organization-id",
      false,
      true,
    );
    expect(mocks.Paper.updateMany).toHaveBeenCalledWith(
      { deviceId: "device-object-id" },
      { $unset: { deviceId: 1 } },
      { session: mocks.session },
    );
    expect(mocks.Device.deleteOne).toHaveBeenCalledWith(
      {
        _id: "device-object-id",
        deviceId: mocks.device.deviceId,
      },
      { session: mocks.session },
    );
    expect(result.deleted).toEqual({
      devices: 1,
    });
    expect(result.updated).toEqual({
      papers: 2,
    });
  });

  it("rejects a confirmation token when the dry-run impact changed", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    mocks.state.targetPaperIds.push("paper-added-after-dry-run");

    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: mocks.device.deviceId,
        confirmationToken: preview.confirmationToken,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.iotDevicesService.activateDevice).not.toHaveBeenCalled();
    expect(mocks.Paper.updateMany).not.toHaveBeenCalled();
    expect(mocks.Device.deleteOne).not.toHaveBeenCalled();
  });

  it("falls back without transactions in production when MongoDB does not support them", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    const unsupportedTransactionError = Object.assign(
      new Error(
        "Transaction numbers are only allowed on a replica set member or mongos",
      ),
      { code: 20 },
    );
    mocks.session.withTransaction.mockRejectedValue(
      unsupportedTransactionError,
    );

    const result = await service.deactivateDeviceByDeviceId({
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    });

    expect(mocks.session.withTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledWith(
      mocks.device.deviceId,
      "organization-id",
      false,
      true,
    );
    expect(mocks.Paper.updateMany).toHaveBeenCalledWith(
      { deviceId: "device-object-id" },
      { $unset: { deviceId: 1 } },
      {},
    );
    expect(mocks.Device.deleteOne).toHaveBeenCalledWith(
      {
        _id: "device-object-id",
        deviceId: mocks.device.deviceId,
      },
      {},
    );
    expect(result).toMatchObject({
      deleted: { devices: 1 },
      updated: { papers: 2 },
      iotDeviceDeactivated: true,
    });
  });
});
