import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const iot = vi.hoisted(() => ({
  activateDevice: vi.fn(async () => ({ activation_status: "success" })),
}));

// Exercise the real MongoDB queries and receipt model without loading the API
// application or contacting IoT/Auth0/S3. Use a dedicated disposable database.
vi.mock("@internetderdinge/api", async () => {
  const { default: db } = await import("mongoose");
  class ApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    Device: db.model(
      "DeactivationPersistenceDevice",
      new db.Schema(
        {
          deviceId: String,
          organization: db.Schema.Types.ObjectId,
          kind: String,
        },
        { timestamps: true },
      ),
    ),
    iotDevicesService: iot,
    getSignedFileUrl: vi.fn(),
    paginate: () => {},
    toJSON: () => {},
  };
});
vi.mock("../../src/iotdevice/iotdevice.service", () => ({ default: {} }));
vi.mock("@aws-sdk/client-s3", () => ({
  HeadObjectCommand: class {},
  S3Client: class {},
}));

import { Device } from "@internetderdinge/api";
import Paper from "../../src/papers/papers.model.js";
import DeviceDeactivation from "../../src/devices/deviceDeactivation.model.js";
import service from "../../src/devices/devices.service";

const databaseUrl = process.env.DEACTIVATION_TEST_MONGODB_URL;
describe.skipIf(!databaseUrl)("device deactivation MongoDB persistence", () => {
  const serial = "epd-persistence-test";
  let device: any;
  let paper: any;

  beforeAll(async () => {
    if (
      !new URL(databaseUrl!).pathname.startsWith(
        "/paperless-deactivation-test-",
      )
    ) {
      throw new Error(
        "Use a disposable database named paperless-deactivation-test-*.",
      );
    }
    await mongoose.connect(databaseUrl!);
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      Device.deleteMany({}),
      Paper.deleteMany({}),
      DeviceDeactivation.deleteMany({}),
    ]);
    device = await Device.create({
      deviceId: serial,
      kind: "epd7",
      organization: new mongoose.Types.ObjectId(),
    });
    paper = await Paper.create({ deviceId: device._id, kind: "image" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cleans up despite a concurrent timestamp update", async () => {
    const preview = await service.getDeviceDeactivationPreview(serial);
    iot.activateDevice.mockImplementationOnce(async () => {
      await Device.updateOne(
        { _id: device._id },
        { $set: { updatedAt: new Date(Date.now() + 1000) } },
      );
      return { activation_status: "success" };
    });
    await expect(
      service.deactivateDeviceByDeviceId({
        deviceId: serial,
        confirmationToken: preview.confirmationToken,
      }),
    ).resolves.toMatchObject({
      deleted: { devices: 1 },
      updated: { papers: 1 },
    });
    expect(await Device.findById(device._id)).toBeNull();
    expect((await Paper.findById(paper._id)).deviceId).toBeUndefined();
    expect(
      (await DeviceDeactivation.findById(device.id)).result
        .iotDeviceDeactivated,
    ).toBe(true);
  });

  it("resumes a partial standalone cleanup using the persisted receipt", async () => {
    const preview = await service.getDeviceDeactivationPreview(serial);
    const input = {
      deviceId: serial,
      confirmationToken: preview.confirmationToken,
    };
    vi.spyOn(Device, "deleteOne").mockRejectedValueOnce(
      new Error("Database write failed"),
    );
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(await Device.findById(device._id)).not.toBeNull();
    expect((await Paper.findById(paper._id)).deviceId).toBeUndefined();
    expect(
      (await DeviceDeactivation.findById(device.id)).preview.confirmationToken,
    ).toBe(preview.confirmationToken);
    await expect(service.getDeviceDeactivationPreview(serial)).resolves.toEqual(
      preview,
    );
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).resolves.toMatchObject({ deleted: { devices: 1 } });
    expect(iot.activateDevice).toHaveBeenCalledTimes(1);
  });

  it("never deletes a replacement registered under the same serial on retry", async () => {
    const preview = await service.getDeviceDeactivationPreview(serial);
    const input = {
      deviceId: serial,
      confirmationToken: preview.confirmationToken,
    };
    const originalUpdate =
      DeviceDeactivation.updateOne.bind(DeviceDeactivation);
    vi.spyOn(DeviceDeactivation, "updateOne").mockImplementation(
      (filter: any, update: any, options: any) => {
        if (update.$set?.result) throw new Error("Saving result failed");
        return originalUpdate(filter, update, options);
      },
    );
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).rejects.toMatchObject({ statusCode: 503 });
    vi.restoreAllMocks();
    const replacement = await Device.create({ deviceId: serial, kind: "epd7" });
    const replacementPaper = await Paper.create({
      deviceId: replacement._id,
      kind: "image",
    });
    await expect(
      service.deactivateDeviceByDeviceId(input),
    ).resolves.toMatchObject({ iotDeviceDeactivated: true });
    expect(await Device.findById(replacement._id)).not.toBeNull();
    expect(
      (await Paper.findById(replacementPaper._id)).deviceId.toString(),
    ).toBe(replacement.id);
    expect(iot.activateDevice).toHaveBeenCalledTimes(1);
  });
});
