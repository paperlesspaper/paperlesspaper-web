import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const iot = vi.hoisted(() => ({ activateDevice: vi.fn() }));
const cache = vi.hoisted(() => ({ resetDeviceImageCache: vi.fn() }));
vi.mock("../../src/iotdevice/deviceImageCache.js", () => cache);
vi.mock("@internetderdinge/api", async () => {
  const { default: RealDevice } = await import(
    "@internetderdinge/api/src/devices/devices.model.ts"
  );
  return {
    ApiError: class extends Error {
      constructor(public statusCode: number, message: string) {
        super(message);
      }
    },
    Device: RealDevice,
    iotDevicesService: iot,
    usersService: { getById: vi.fn(async () => null) },
    paginate: () => {},
    toJSON: () => {},
  };
});

import { Device } from "@internetderdinge/api";
import Paper from "../../src/papers/papers.model.js";
import DevicesLogs from "../../src/devicesLogs/devicesLogs.model.js";
import { getDeviceUploadLogs } from "../../src/devicesLogs/devicesLogs.service.js";
import {
  getRegistrationStatus,
  registerDevice,
} from "../../src/devices/deviceRegistration.service.js";

const url = process.env.REGISTRATION_TEST_MONGODB_URL;
describe.skipIf(!url)("device registration MongoDB persistence", () => {
  const deviceId = "epd7-registration-test";
  const orgA = new mongoose.Types.ObjectId();
  const orgB = new mongoose.Types.ObjectId();
  const body = { organization: String(orgB), enable: false };
  const confirmed = {
    success: true,
    activation_status: "success",
    key: "SECRET",
  };
  let previous: any;
  let paper: any;

  beforeAll(async () => {
    if (!new URL(url!).pathname.startsWith("/paperless-registration-test-")) {
      throw new Error(
        "Use a disposable database named paperless-registration-test-*"
      );
    }
    await mongoose.connect(url!);
    await Device.init();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    iot.activateDevice.mockReset();
    cache.resetDeviceImageCache.mockReset().mockResolvedValue(undefined);
    await Device.deleteMany({});
    await Paper.deleteMany({});
    await DevicesLogs.deleteMany({});
    previous = await Device.create({
      deviceId,
      organization: orgA,
      kind: "epd7",
      meta: { secret: "old-content" },
      payment: { customer: "old-customer" },
    });
    paper = await Paper.create({
      organization: orgA,
      deviceId: previous._id,
      name: "Keep this paper",
    });
  });

  it("allows checking a foreign device without resetting or exposing its owner", async () => {
    iot.activateDevice.mockResolvedValue({
      activation_status: "success",
      success: true,
    });
    expect(await getRegistrationStatus(deviceId, String(orgB))).toEqual({
      available: true,
      mode: "takeover",
    });
    expect(iot.activateDevice).toHaveBeenCalledExactlyOnceWith(
      deviceId,
      String(orgB),
      false
    );
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
    expect(cache.resetDeviceImageCache).not.toHaveBeenCalled();
  });

  it("starts a takeover without resetting or removing the existing assignment", async () => {
    iot.activateDevice
      .mockResolvedValueOnce({ activation_status: "success" })
      .mockResolvedValueOnce({ activation_status: "pending" });
    expect(
      await registerDevice(deviceId, { ...body, enable: true })
    ).toMatchObject({
      activation_status: "pending",
      registrationCompleted: false,
    });
    expect(iot.activateDevice.mock.calls).toEqual([
      [deviceId, String(orgB), false],
      [deviceId, String(orgB), true],
    ]);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
  });

  it("rejects a missing IoT status without changing an existing assignment", async () => {
    iot.activateDevice.mockResolvedValue({ success: true });
    await expect(
      getRegistrationStatus(deviceId, String(orgB))
    ).rejects.toMatchObject({ statusCode: 502 });
    await expect(
      registerDevice(deviceId, { ...body, enable: true })
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(
      iot.activateDevice.mock.calls.every((call) => call[2] === false)
    ).toBe(true);
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
    expect(cache.resetDeviceImageCache).not.toHaveBeenCalled();
  });

  it.each([403, 404, 502])(
    "normalizes IoT client errors (%s) without confusing them with caller permissions or changing ownership",
    async (statusCode) => {
      iot.activateDevice.mockRejectedValue(
        Object.assign(new Error("Private upstream details"), { statusCode })
      );
      const expected = {
        statusCode: 502,
        message: "Could not verify device activation",
      };
      await expect(
        getRegistrationStatus(deviceId, String(orgB))
      ).rejects.toMatchObject(expected);
      await expect(
        registerDevice(deviceId, { ...body, enable: true })
      ).rejects.toMatchObject(expected);
      expect(
        iot.activateDevice.mock.calls.every((call) => call[2] === false)
      ).toBe(true);
      expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
      expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
      expect(cache.resetDeviceImageCache).not.toHaveBeenCalled();
    }
  );

  it("surfaces a lost start acknowledgement as retryable without repeating the start or detaching the active owner", async () => {
    iot.activateDevice
      .mockResolvedValueOnce({ activation_status: "success" })
      .mockRejectedValueOnce(new Error("Connection reset after start"));
    await expect(
      registerDevice(deviceId, { ...body, enable: true })
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(iot.activateDevice.mock.calls.map((call) => call[2])).toEqual([
      false,
      true,
    ]);
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
    expect(cache.resetDeviceImageCache).not.toHaveBeenCalled();
  });

  it("rejects a malformed activation acknowledgement instead of returning an undefined state", async () => {
    iot.activateDevice
      .mockResolvedValueOnce({ activation_status: "success" })
      .mockResolvedValueOnce({ success: true });
    await expect(
      registerDevice(deviceId, { ...body, enable: true })
    ).rejects.toMatchObject({ statusCode: 502 });
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
  });

  it.each(["pending", "timeout", "success", "reset"])(
    "preserves ownership and papers for unconfirmed %s",
    async (activation_status) => {
      iot.activateDevice.mockResolvedValue({
        activation_status,
        success: true,
      });
      const result = await registerDevice(deviceId, body);
      expect(result.registrationCompleted).toBe(false);
      expect(result.activation_status).toBe(
        activation_status === "success" ? "timeout" : activation_status
      );
      expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
      expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
      expect(cache.resetDeviceImageCache).not.toHaveBeenCalled();
    }
  );

  it("transfers confirmed ownership, detaches papers without deleting them, and removes old settings", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    const result = await registerDevice(deviceId, body);
    expect(result.registrationCompleted).toBe(true);
    expect(JSON.stringify(result)).not.toContain("SECRET");
    const device = await Device.findOne({ deviceId });
    expect(device?._id).not.toEqual(previous._id);
    expect(await Device.findById(previous._id)).toBeNull();
    expect(device?.organization).toEqual(orgB);
    expect(device?.meta).toBeUndefined();
    expect(device?.payment).toBeUndefined();
    expect(cache.resetDeviceImageCache).toHaveBeenCalledExactlyOnceWith(
      deviceId
    );
    expect(await Paper.countDocuments({ _id: paper._id })).toBe(1);
    expect((await Paper.findById(paper._id))?.deviceId).toBeUndefined();
    expect((await Paper.findById(paper._id))?.organization).toEqual(orgA);
    expect(iot.activateDevice).toHaveBeenCalledExactlyOnceWith(
      deviceId,
      String(orgB),
      false
    );
  });

  it("keeps repeated successful completion idempotent and preserves the new owner's papers", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    const first = await registerDevice(deviceId, body);
    const newPaper = await Paper.create({
      organization: orgB,
      deviceId: first.createdDevice._id,
    });
    const second = await registerDevice(deviceId, body);
    expect(second.createdDevice._id).toEqual(first.createdDevice._id);
    expect(await Device.countDocuments({ deviceId })).toBe(1);
    expect(cache.resetDeviceImageCache).toHaveBeenCalledTimes(2);
    expect((await Paper.findById(newPaper._id))?.deviceId).toEqual(
      first.createdDevice._id
    );
  });

  it("preserves papers after a partial save failure and can retry without transactions", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    vi.spyOn(Device.collection, "insertOne").mockRejectedValueOnce(
      new Error("storage failure")
    );
    await expect(registerDevice(deviceId, body)).rejects.toThrow(
      "storage failure"
    );
    expect(await Device.findOne({ deviceId })).toBeNull();
    expect(await Paper.countDocuments({ _id: paper._id })).toBe(1);
    expect((await Paper.findById(paper._id))?.deviceId).toBeUndefined();
    expect((await registerDevice(deviceId, body)).registrationCompleted).toBe(
      true
    );
    expect(
      iot.activateDevice.mock.calls.every(
        (call) => call[2] === false && call[3] !== true
      )
    ).toBe(true);
  });

  it("retries cache deletion before changing the database assignment", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    cache.resetDeviceImageCache.mockRejectedValueOnce(
      new Error("S3 unavailable")
    );
    await expect(registerDevice(deviceId, body)).rejects.toThrow(
      "S3 unavailable"
    );
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
    expect((await registerDevice(deviceId, body)).registrationCompleted).toBe(
      true
    );
    expect(cache.resetDeviceImageCache).toHaveBeenCalledTimes(2);
  });

  it("does not delete the old assignment when paper detachment fails", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    vi.spyOn(Paper, "updateMany").mockRejectedValueOnce(
      new Error("write failed")
    );
    await expect(registerDevice(deviceId, body)).rejects.toThrow(
      "write failed"
    );
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
    expect((await registerDevice(deviceId, body)).registrationCompleted).toBe(
      true
    );
  });

  it("starts an orphan takeover without resetting a device whose ownership is unproven", async () => {
    await Device.deleteMany({});
    iot.activateDevice
      .mockResolvedValueOnce({ success: true, activation_status: "success" })
      .mockResolvedValueOnce({ activation_status: "pending" });
    await registerDevice(deviceId, { ...body, enable: true });
    expect(iot.activateDevice.mock.calls).toEqual([
      [deviceId, String(orgB), false],
      [deviceId, String(orgB), true],
    ]);
    expect(await Device.countDocuments({})).toBe(0);
  });

  it("creates a new device only after proof and never resets while polling", async () => {
    await Device.deleteMany({});
    iot.activateDevice.mockResolvedValue(confirmed);
    const result = await registerDevice(deviceId, body);
    expect(result.createdDevice.organization).toEqual(orgB);
    expect(iot.activateDevice).toHaveBeenCalledExactlyOnceWith(
      deviceId,
      String(orgB),
      false
    );
  });

  it("completes concurrent polls for the same verified owner with one assignment", async () => {
    await Device.deleteMany({});
    iot.activateDevice.mockResolvedValue(confirmed);
    // Both requests reach the save phase before either may insert.
    let release: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let arrivals = 0;
    cache.resetDeviceImageCache.mockImplementation(async () => {
      if (++arrivals === 2) release();
      await barrier;
    });
    const [first, second] = await Promise.all([
      registerDevice(deviceId, body),
      registerDevice(deviceId, body),
    ]);
    expect(first.registrationCompleted).toBe(true);
    expect(second.registrationCompleted).toBe(true);
    expect(String(first.createdDevice._id)).toBe(
      String(second.createdDevice._id)
    );
    expect(await Device.countDocuments({ deviceId })).toBe(1);
  });

  it("does not accept a concurrently inserted assignment belonging to another organization", async () => {
    await Device.deleteMany({});
    iot.activateDevice.mockResolvedValue(confirmed);
    cache.resetDeviceImageCache.mockImplementationOnce(async () => {
      await Device.create({ deviceId, organization: orgA, kind: "epd7" });
    });
    await expect(registerDevice(deviceId, body)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
  });

  it.each(["reset", "timeout", "unclaimed"])(
    "preserves an unconfirmed %s assignment until the new owner is verified",
    async (activation_status) => {
      iot.activateDevice
        .mockResolvedValueOnce({ activation_status })
        .mockResolvedValueOnce({ activation_status: "pending" });
      await registerDevice(deviceId, { ...body, enable: true });
      expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgA);
      expect(await Paper.countDocuments({ _id: paper._id })).toBe(1);
      expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
      expect(iot.activateDevice.mock.calls).toEqual([
        [deviceId, String(orgB), false],
        [deviceId, String(orgB), true],
      ]);
    }
  );

  it("keeps an already registered device in the same organization intact", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    expect(await getRegistrationStatus(deviceId, String(orgA))).toMatchObject({
      mode: "already_registered",
    });
    const result = await registerDevice(deviceId, {
      organization: String(orgA),
      enable: true,
    });
    expect(result.createdDevice._id).toEqual(previous._id);
    expect(cache.resetDeviceImageCache).toHaveBeenCalledExactlyOnceWith(deviceId);
    expect(result.createdDevice.meta).toEqual({ secret: "old-content" });
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
    expect(
      iot.activateDevice.mock.calls.every((call) => call[2] === false)
    ).toBe(true);
    expect(
      iot.activateDevice.mock.calls.every((call) => call[3] !== true)
    ).toBe(true);
  });

  it("retries failed same-owner cache invalidation without losing the device or papers", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    cache.resetDeviceImageCache.mockRejectedValueOnce(
      new Error("S3 unavailable")
    );
    const sameOwner = { organization: String(orgA), enable: false };

    await expect(registerDevice(deviceId, sameOwner)).rejects.toThrow(
      "S3 unavailable"
    );
    expect((await Device.findOne({ deviceId }))?._id).toEqual(previous._id);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);

    const result = await registerDevice(deviceId, sameOwner);
    expect(result.registrationCompleted).toBe(true);
    expect(result.createdDevice._id).toEqual(previous._id);
    expect(cache.resetDeviceImageCache).toHaveBeenCalledTimes(2);
  });

  it("rejects same-owner completion if ownership changes during cache invalidation", async () => {
    iot.activateDevice.mockResolvedValue(confirmed);
    cache.resetDeviceImageCache.mockImplementationOnce(async () => {
      await Device.deleteOne({ _id: previous._id });
      await Device.create({ deviceId, organization: orgB, kind: "epd7" });
    });
    await expect(
      registerDevice(deviceId, {
        organization: String(orgA),
        enable: false,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await Device.findOne({ deviceId }))?.organization).toEqual(orgB);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
  });

  it("rejects invalid target references before calling IoT", async () => {
    await expect(
      registerDevice(deviceId, {
        ...body,
        patient: String(new mongoose.Types.ObjectId()),
      })
    ).rejects.toThrow("Patient is not part");
    expect(iot.activateDevice).not.toHaveBeenCalled();
  });

  it("does not expose the previous organization's upload logs after takeover", async () => {
    await DevicesLogs.create({
      attemptId: "previous-owner-upload",
      deviceName: deviceId,
      deviceId: String(previous._id),
      paperId: String(paper._id),
      render: { url: "https://previous-owner.invalid/private-dashboard" },
      startedAt: new Date(),
    });
    iot.activateDevice.mockResolvedValue(confirmed);
    const result = await registerDevice(deviceId, body);
    const visibleLogs = await getDeviceUploadLogs({
      deviceId: String(result.createdDevice._id),
      deviceName: deviceId,
    });
    expect(visibleLogs).toEqual([]);
  });

  it("finishes Start again after a failed first save without resetting confirmed ownership", async () => {
    await Device.deleteMany({});
    iot.activateDevice.mockResolvedValue(confirmed);
    vi.spyOn(Device.collection, "insertOne").mockRejectedValueOnce(
      new Error("temporary storage outage")
    );
    await expect(registerDevice(deviceId, body)).rejects.toThrow(
      "temporary storage outage"
    );

    // The hardware has confirmed this organization, but the first local save failed.
    // The UI's Start again path sends enable:true, rather than resuming polling.
    iot.activateDevice.mockReset();
    iot.activateDevice.mockImplementation(async (_id, _org, enable, reset) =>
      reset
        ? { activation_status: "reset" }
        : enable
        ? { activation_status: "pending" }
        : confirmed
    );
    const result = await registerDevice(deviceId, { ...body, enable: true });
    expect(iot.activateDevice).toHaveBeenCalledExactlyOnceWith(
      deviceId,
      String(orgB),
      false
    );
    expect(result.registrationCompleted).toBe(true);
    expect(result.activation_status).toBe("success");
    expect(await Device.countDocuments({ deviceId })).toBe(1);
  });
  it("rejects stale proof if the assignment changed while IoT was responding", async () => {
    let replacement: any;
    iot.activateDevice.mockImplementationOnce(async () => {
      await Device.deleteOne({ _id: previous._id });
      replacement = await Device.create({
        deviceId,
        organization: orgA,
        kind: "epd7",
      });
      return confirmed;
    });
    await expect(registerDevice(deviceId, body)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await Device.findOne({ deviceId }))?._id).toEqual(replacement._id);
    expect(cache.resetDeviceImageCache).not.toHaveBeenCalled();
  });

  it("keeps the winning owner when a competing organization's proof arrives late", async () => {
    const orgC = new mongoose.Types.ObjectId();
    let releaseC: (status: typeof confirmed) => void;
    let startedC: () => void;
    const waitingC = new Promise<void>((resolve) => {
      startedC = resolve;
    });
    iot.activateDevice.mockImplementation(async (_id, organization) => {
      if (organization === String(orgC)) {
        startedC();
        return new Promise((resolve) => {
          releaseC = resolve;
        });
      }
      return confirmed;
    });
    const attemptC = registerDevice(deviceId, {
      ...body,
      organization: String(orgC),
    });
    const rejectedC = expect(attemptC).rejects.toMatchObject({
      statusCode: 409,
    });
    await waitingC;
    const winner = await registerDevice(deviceId, body);
    const winnerPaper = await Paper.create({
      organization: orgB,
      deviceId: winner.createdDevice._id,
    });
    releaseC!(confirmed);
    await rejectedC;
    expect((await Device.findOne({ deviceId }))?._id).toEqual(
      winner.createdDevice._id
    );
    expect((await Paper.findById(winnerPaper._id))?.deviceId).toEqual(
      winner.createdDevice._id
    );
    expect(cache.resetDeviceImageCache).toHaveBeenCalledTimes(1);
  });

  it("does not remove a replacement created while image cache cleanup was pending", async () => {
    let replacement: any;
    iot.activateDevice.mockResolvedValue(confirmed);
    cache.resetDeviceImageCache.mockImplementationOnce(async () => {
      await Device.deleteOne({ _id: previous._id });
      replacement = await Device.create({
        deviceId,
        organization: orgA,
        kind: "epd7",
      });
    });
    await expect(registerDevice(deviceId, body)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await Device.findOne({ deviceId }))?._id).toEqual(replacement._id);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
  });
});
