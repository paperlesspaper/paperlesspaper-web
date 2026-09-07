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
    receipt: null as any,
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
  const DeviceDeactivation = {
    findById: vi.fn(() => makeQuery(() => state.receipt)),
    findOne: vi.fn((filter: any) =>
      makeQuery(() =>
        state.receipt?.deviceId === filter.deviceId &&
        state.receipt?.preview.confirmationToken ===
          filter["preview.confirmationToken"]
          ? state.receipt
          : null,
      ),
    ),
    updateOne: vi.fn(async (_filter: any, update: any) => {
      if (update.$setOnInsert && !state.receipt) {
        state.receipt = structuredClone(update.$setOnInsert);
      }
      if (update.$set)
        Object.assign(state.receipt, structuredClone(update.$set));
      return { modifiedCount: 1 };
    }),
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
    DeviceDeactivation,
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

vi.mock("../../src/devices/deviceDeactivation.model.js", () => ({
  default: mocks.DeviceDeactivation,
}));

import service from "../../src/devices/devices.service";

describe("device deactivation service", () => {
  beforeEach(() => {
    mocks.state.targetPaperIds = ["paper-a", "paper-b"];
    mocks.state.receipt = null;
    mocks.device.updatedAt = new Date("2026-08-13T08:00:00.000Z");
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

  it("finishes cleanup when a cronjob updates the device during the IoT reset", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    mocks.iotDevicesService.activateDevice.mockImplementationOnce(async () => {
      mocks.device.updatedAt = new Date("2026-08-13T08:00:01.000Z");
      return { activation_status: "success" };
    });

    const result = await service.deactivateDeviceByDeviceId({
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    });

    expect(result).toMatchObject({
      deleted: { devices: 1 },
      updated: { papers: 2 },
    });
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
  });

  it("resumes cleanup after a database failure without repeating the IoT reset", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    mocks.Paper.updateMany.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );
    const input = {
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    };

    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.state.receipt.preview).toEqual(preview);
    mocks.device.updatedAt = new Date("2026-08-13T08:01:00.000Z");

    await expect(
      service.getDeviceDeactivationPreview(mocks.device.deviceId),
    ).resolves.toEqual(preview);
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).resolves.toMatchObject({
      deleted: { devices: 1 },
      updated: { papers: 2 },
      iotDeviceDeactivated: true,
    });
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
  });

  it("replays a completed result without additional resets or writes", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    const input = {
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    };
    const first = await service.deactivateDeviceByDeviceId(input);
    await expect(service.deactivateDeviceByDeviceId(input)).resolves.toEqual(
      first,
    );
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
    expect(mocks.Paper.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.Device.deleteOne).toHaveBeenCalledTimes(1);
  });

  it("does not detach papers when the IoT reset fails", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    mocks.iotDevicesService.activateDevice.mockRejectedValueOnce(
      new Error("IoT unavailable"),
    );
    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: mocks.device.deviceId,
        confirmationToken: preview.confirmationToken,
      }),
    ).rejects.toThrow("IoT unavailable");
    expect(mocks.state.receipt).toBeNull();
    expect(mocks.Paper.updateMany).not.toHaveBeenCalled();
    expect(mocks.Device.deleteOne).not.toHaveBeenCalled();
  });

  it("reports an unsaved reset confirmation without promising a safe retry", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    mocks.DeviceDeactivation.updateOne.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );
    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: mocks.device.deviceId,
        confirmationToken: preview.confirmationToken,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("Verify the IoT device state"),
    });
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
    expect(mocks.state.receipt).toBeNull();
    expect(mocks.Paper.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a wrong token when cleanup is pending", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    mocks.Paper.updateMany.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );
    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: mocks.device.deviceId,
        confirmationToken: preview.confirmationToken,
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: mocks.device.deviceId,
        confirmationToken: "0".repeat(64),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
  });

  it("can finish a standalone-MongoDB retry after papers were already detached", async () => {
    mocks.session.withTransaction.mockRejectedValue(
      Object.assign(new Error("does not support transactions"), { code: 20 }),
    );
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    const input = {
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    };
    mocks.Device.deleteOne.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).rejects.toMatchObject({ statusCode: 503 });
    mocks.state.targetPaperIds = [];

    await expect(
      service.getDeviceDeactivationPreview(mocks.device.deviceId),
    ).resolves.toEqual(preview);
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).resolves.toMatchObject({ deleted: { devices: 1 } });
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
    expect(mocks.Device.deleteOne).toHaveBeenLastCalledWith(
      { _id: "device-object-id", deviceId: mocks.device.deviceId },
      {},
    );
  });

  it("can resume after deletion committed but saving the response failed", async () => {
    const preview = await service.getDeviceDeactivationPreview(
      mocks.device.deviceId,
    );
    const input = {
      deviceId: mocks.device.deviceId,
      confirmationToken: preview.confirmationToken,
    };
    const updateReceipt =
      mocks.DeviceDeactivation.updateOne.getMockImplementation()!;
    mocks.DeviceDeactivation.updateOne
      .mockImplementationOnce(updateReceipt)
      .mockRejectedValueOnce(new Error("Result write failed"));
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).rejects.toMatchObject({ statusCode: 503 });
    mocks.Device.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    mocks.state.targetPaperIds = [];
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).resolves.toMatchObject({ iotDeviceDeactivated: true });
    expect(mocks.iotDevicesService.activateDevice).toHaveBeenCalledTimes(1);
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
