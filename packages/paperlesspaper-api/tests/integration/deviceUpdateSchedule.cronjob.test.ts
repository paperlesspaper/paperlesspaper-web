import { beforeEach, describe, expect, it, vi } from "vitest";

const queryDevicesByUserMock = vi.fn();
const populateDeviceStatusMock = vi.fn();
const shadowAlarmUpdateMock = vi.fn();

vi.mock("@internetderdinge/api", () => ({
  devicesService: {
    queryDevicesByUser: queryDevicesByUserMock,
    populateDeviceStatus: populateDeviceStatusMock,
  },
  iotDevicesService: {
    shadowAlarmUpdate: shadowAlarmUpdateMock,
  },
}));

const buildDailyRrule = (date: string, time: string) =>
  `DTSTART;TZID=Europe/Berlin:${date.replace(/-/g, "")}T${time.replace(
    ":",
    "",
  )}00\nRRULE:FREQ=DAILY;INTERVAL=1`;

const buildWeeklyRrule = (date: string, time: string) =>
  `DTSTART;TZID=Europe/Berlin:${date.replace(/-/g, "")}T${time.replace(
    ":",
    "",
  )}00\nRRULE:FREQ=WEEKLY;INTERVAL=1`;

const buildDevice = (overrides: Record<string, unknown> = {}) => ({
  deviceId: "epd7-schedule-test",
  kind: "epd7",
  meta: {
    sleepTime: "7200",
    updateSchedule: {
      enabled: true,
      timezone: "Europe/Berlin",
      windows: [
        {
          id: "daily-business-hours",
          startsAt: "2026-06-01T06:00:00.000Z",
          durationMinutes: 9 * 60,
          repeat: "daily",
          rrule: buildDailyRrule("2026-06-01", "08:00"),
        },
      ],
    },
  },
  ...overrides,
});

describe("device update schedule cronjob", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("restores normal sleep time when the wakeup is inside an allowed window", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice(),
      deviceStatus: { nextDeviceSync: "2026-06-01T07:00:00.000Z" },
      now: new Date("2026-06-01T06:55:00.000Z"),
    });

    expect(decision).toEqual({
      action: "restore",
      sleepTime: 7200,
      reason: "inside-window",
    });
  });

  it("defers a wakeup outside a daily allowed window to the next start", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice(),
      deviceStatus: { nextDeviceSync: "2026-06-01T16:00:00.000Z" },
      now: new Date("2026-06-01T15:55:00.000Z"),
    });

    expect(decision).toMatchObject({
      action: "defer",
      sleepTime: 50700,
      nextAllowedAt: "2026-06-02T06:00:00.000Z",
      reason: "outside-window",
    });
  });

  it("models weekend exclusion with weekday allowed windows", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const weekdayWindows = [
      ["2026-06-01", "mon"],
      ["2026-06-02", "tue"],
      ["2026-06-03", "wed"],
      ["2026-06-04", "thu"],
      ["2026-06-05", "fri"],
    ].map(([date, id]) => ({
      id,
      startsAt: `${date}T06:00:00.000Z`,
      durationMinutes: 9 * 60,
      repeat: "weekly",
      rrule: buildWeeklyRrule(date, "08:00"),
    }));

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice({
        meta: {
          sleepTime: "3600",
          updateSchedule: {
            enabled: true,
            timezone: "Europe/Berlin",
            windows: weekdayWindows,
          },
        },
      }),
      deviceStatus: { nextDeviceSync: "2026-06-06T08:00:00.000Z" },
      now: new Date("2026-06-06T07:55:00.000Z"),
    });

    expect(decision).toMatchObject({
      action: "defer",
      nextAllowedAt: "2026-06-08T06:00:00.000Z",
      reason: "outside-window",
    });
  });

  it("parks enabled schedules without windows for one day", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice({
        meta: {
          sleepTime: "3600",
          updateSchedule: {
            enabled: true,
            timezone: "Europe/Berlin",
            windows: [],
          },
        },
      }),
      deviceStatus: { nextDeviceSync: "2026-06-01T08:00:00.000Z" },
      now: new Date("2026-06-01T07:55:00.000Z"),
    });

    expect(decision).toEqual({
      action: "defer",
      sleepTime: 86400,
      reason: "no-windows",
    });
  });

  it("skips invalid rrules without failing the decision", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice({
        meta: {
          sleepTime: "3600",
          updateSchedule: {
            enabled: true,
            timezone: "Europe/Berlin",
            windows: [
              {
                id: "broken",
                startsAt: "2026-06-01T06:00:00.000Z",
                durationMinutes: 60,
                repeat: "daily",
                rrule: "not an rrule",
              },
            ],
          },
        },
      }),
      deviceStatus: { nextDeviceSync: "2026-06-01T08:00:00.000Z" },
      now: new Date("2026-06-01T07:55:00.000Z"),
    });

    expect(decision).toEqual({
      action: "defer",
      sleepTime: 86400,
      reason: "outside-window",
    });
  });

  it("updates IoT shadow sleep times for due devices", async () => {
    const { cronjobDeviceUpdateSchedule } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const insideDevice = buildDevice({ deviceId: "inside-window" });
    const outsideDevice = buildDevice({ deviceId: "outside-window" });
    const noDeviceId = buildDevice({ deviceId: "" });

    queryDevicesByUserMock.mockResolvedValue({
      results: [insideDevice, outsideDevice, noDeviceId],
    });
    populateDeviceStatusMock.mockImplementation((device) => {
      if (device.deviceId === "inside-window") {
        return { nextDeviceSync: "2026-06-01T07:00:00.000Z" };
      }
      return { nextDeviceSync: "2026-06-01T16:00:00.000Z" };
    });
    shadowAlarmUpdateMock.mockResolvedValue({ status: "ok" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T15:55:00.000Z"));

    const result = await cronjobDeviceUpdateSchedule({
      id: "job-1",
      name: "deviceUpdateScheduleCronjob",
    } as any);

    expect(queryDevicesByUserMock).toHaveBeenCalledWith(
      {
        kind: { $in: ["epaper", "epd7", "openpaper13", "epaper-13"] },
        "meta.updateSchedule.enabled": true,
      },
      { limit: -1 },
    );
    expect(shadowAlarmUpdateMock).toHaveBeenCalledTimes(1);
    expect(shadowAlarmUpdateMock).toHaveBeenCalledWith(
      "outside-window",
      {
        state: {
          reported: {
            sleepTime: 50700,
          },
        },
      },
      "settings",
    );
    expect(result.meta.devices).toMatchObject({
      totalFetched: 3,
      processed: 2,
      skipped: 2,
      updated: 1,
    });

    vi.useRealTimers();
  });
});
