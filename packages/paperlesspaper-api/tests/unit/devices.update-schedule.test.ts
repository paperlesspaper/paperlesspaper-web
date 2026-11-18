import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateById: vi.fn(),
  getByIdWithIoT: vi.fn(),
  shadowAlarmUpdate: vi.fn(),
  updateIotDevice: vi.fn(),
  isAdmin: vi.fn(),
}));
vi.mock("@internetderdinge/api", () => ({
  catchAsync: (handler: unknown) => handler,
  ApiError: class extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
  isAdmin: mocks.isAdmin,
  devicesService: {
    updateById: mocks.updateById,
    getByIdWithIoT: mocks.getByIdWithIoT,
  },
  iotDevicesService: {
    shadowAlarmUpdate: mocks.shadowAlarmUpdate,
    updateDevice: mocks.updateIotDevice,
  },
}));
vi.mock("../../src/render/render.service.js", () => ({ default: {} }));
vi.mock("../../src/devicesLogs/devicesLogs.service.js", () => ({
  default: {},
}));
vi.mock("../../src/devices/devices.service.js", () => ({ default: {} }));

import controller from "../../src/devices/devices.controller";

const schedule = {
  enabled: true,
  timezone: "Europe/Berlin",
  windows: [{ startsAt: "2026-11-09T01:15:00Z", durationMinutes: 10 }],
};

describe("apply device schedule when settings are saved", () => {
  let device: any;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T01:05:00Z"));
    mocks.isAdmin.mockReturnValue(false);
    mocks.shadowAlarmUpdate.mockResolvedValue({});
    device = {
      id: "device-id",
      deviceId: "epd13-test",
      kind: "openpaper13",
      meta: { sleepTime: "180", updateSchedule: schedule },
    };
    mocks.updateById.mockImplementation(async (_id, body) => ({
      ...device,
      ...body,
    }));
    mocks.getByIdWithIoT.mockResolvedValue({
      ...device,
      shadow: { state: { reported: { sleepTime: 600 } } },
    });
  });
  afterEach(() => vi.useRealTimers());

  const save = async (body: any = { meta: device.meta }) => {
    const res = { req: { auth: {} }, send: vi.fn() };
    await controller.updateEntry(
      { params: { deviceId: "device-id" }, body } as any,
      res as any,
      vi.fn()
    );
    return res;
  };
  const expectSleep = (sleepTime: number) => {
    expect(mocks.shadowAlarmUpdate).toHaveBeenCalledExactlyOnceWith(
      "epd13-test",
      { state: { reported: { sleepTime } } },
      "settings"
    );
  };

  it("sets the delay before responding, without a cron run or predicted device contact", async () => {
    const res = await save();
    expectSleep(600);
    expect(mocks.updateById.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.shadowAlarmUpdate.mock.invocationCallOrder[0]
    );
    expect(mocks.shadowAlarmUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      res.send.mock.invocationCallOrder[0]
    );
    expect(res.send).toHaveBeenCalledWith(
      await mocks.getByIdWithIoT.mock.results[0].value
    );
    // The user's normal interval is retained; only the device setting is overridden.
    expect(mocks.updateById.mock.calls[0][1].meta.sleepTime).toBe("180");
  });

  it("uses the newly saved window instead of the old device schedule", async () => {
    await save({
      meta: {
        ...device.meta,
        updateSchedule: {
          ...schedule,
          windows: [{ startsAt: "2026-11-09T02:15:00Z", durationMinutes: 10 }],
        },
      },
    });
    expectSleep(4200);
  });

  it("keeps the normal interval inside the allowed window", async () => {
    vi.setSystemTime(new Date("2026-11-09T01:16:00Z"));
    await save();
    expectSleep(180);
  });

  it("moves an eight-hour interval from 10:00 to the next day's 08:00 on save", async () => {
    vi.setSystemTime(new Date("2026-11-09T09:00:00Z")); // 10:00 Berlin
    await save({
      meta: {
        ...device.meta,
        sleepTime: "28800",
        updateSchedule: {
          ...schedule,
          windows: [{
            rrule: "DTSTART;TZID=Europe/Berlin:20261109T080000\nRRULE:FREQ=DAILY",
            durationMinutes: 9 * 60,
          }],
        },
      },
    });
    expectSleep(22 * 3600);
    expect(mocks.updateById.mock.calls[0][1].meta.sleepTime).toBe("28800");
  });

  it.each([[], [{ startsAt: "2026-11-08T01:15:00Z", durationMinutes: 10 }]])(
    "parks the frame when no future window remains (%j)",
    async (windows) => {
      await save({
        meta: { ...device.meta, updateSchedule: { ...schedule, windows } },
      });
      expectSleep(86400);
    }
  );

  it("uses the shared recurrence calculation across daylight-saving changes", async () => {
    vi.setSystemTime(new Date("2026-10-24T14:00:00Z"));
    await save({
      meta: {
        ...device.meta,
        updateSchedule: {
          ...schedule,
          windows: [
            {
              rrule:
                "DTSTART;TZID=Europe/Berlin:20261024T080000\nRRULE:FREQ=DAILY",
              durationMinutes: 60,
            },
          ],
        },
      },
    });
    expectSleep(17 * 3600); // Next 08:00 Berlin is 07:00 UTC after the clock change.
  });

  it("leaves disabling a schedule to the shared update's normal interval", async () => {
    await save({
      meta: { ...device.meta, updateSchedule: { enabled: false } },
    });
    expect(mocks.updateById).toHaveBeenCalled();
    expect(mocks.shadowAlarmUpdate).not.toHaveBeenCalled();
    expect(mocks.getByIdWithIoT).not.toHaveBeenCalled();
  });

  it("does not recalculate a schedule for unrelated updates", async () => {
    await save({ paper: "paper-id" });
    expect(mocks.shadowAlarmUpdate).not.toHaveBeenCalled();
  });

  it.each([{ kind: "anabox-smart" }, { deviceId: undefined }])(
    "skips unsupported or unregistered devices (%j)",
    async (overrides) => {
      Object.assign(device, overrides);
      await save();
      expect(mocks.shadowAlarmUpdate).not.toHaveBeenCalled();
    }
  );

  it("does not report successful application when the settings write fails", async () => {
    mocks.shadowAlarmUpdate.mockResolvedValue("error");
    await expect(save()).rejects.toMatchObject({ statusCode: 502 });
    expect(mocks.getByIdWithIoT).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "preserves admin-only payment and IoT updates (admin=%s)",
    async (admin) => {
      mocks.isAdmin.mockReturnValue(admin);
      const payment = { status: "active" };
      const iotDevice = { activated: true };
      await save({
        meta: device.meta,
        updatedAt: "ignored",
        createdAt: "ignored",
        payment,
        iotDevice,
      });
      const body = mocks.updateById.mock.calls[0][1];
      expect(body).not.toHaveProperty("updatedAt");
      expect(body).not.toHaveProperty("createdAt");
      expect(body).not.toHaveProperty("iotDevice");
      expect(body.payment).toEqual(admin ? payment : undefined);
      expect(mocks.updateIotDevice).toHaveBeenCalledTimes(admin ? 1 : 0);
    }
  );
});
