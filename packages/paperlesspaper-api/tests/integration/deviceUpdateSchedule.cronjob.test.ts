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

  it.each([
    ["Europe/Berlin", "20260601", "2026-06-01T06:00:00Z"],
    ["Europe/Berlin", "20261201", "2026-12-01T07:00:00Z"],
    ["America/New_York", "20260601", "2026-06-01T12:00:00Z"],
    ["Asia/Tokyo", "20260602", "2026-06-01T23:00:00Z"],
  ])("keeps the 08:00 window in %s on %s independent of server timezone", async (timezone, day, expected) => {
    const { getAllowedIntervals } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const start = new Date(expected);
    const intervals = getAllowedIntervals({
      windows: [{ durationMinutes: 30, rrule: `DTSTART;TZID=${timezone}:${day}T080000\nRRULE:FREQ=DAILY` }],
      rangeStart: new Date(start.getTime() - 5 * 60000),
      rangeEnd: new Date(start.getTime() + 60 * 60000),
      timezone,
    });
    expect(intervals.map(interval => interval.start.toISOString())).toEqual([start.toISOString()]);
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
      sleepTime: 50400,
      nextAllowedAt: "2026-06-02T06:00:00.000Z",
      reason: "outside-window",
    });
  });

  it("restores the normal interval well before the next allowed wakeup", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice(),
      deviceStatus: { nextDeviceSync: "2026-06-02T06:00:00.000Z" },
      now: new Date("2026-06-01T16:10:00.000Z"),
    });

    expect(decision).toEqual({
      action: "restore",
      sleepTime: 7200,
      reason: "inside-window",
    });
  });

  it.each([
    [180, "2026-06-01T08:03:00Z"],
    [1800, "2026-06-01T08:30:00Z"],
    [3600, "2026-06-01T09:00:00Z"],
    [7200, "2026-06-01T10:00:00Z"],
    [8 * 3600, "2026-06-02T06:00:00Z"],
  ])("keeps the next wakeup inside business hours with a %s-second interval", async (sleepTime, expected) => {
    const { getDeviceUpdateScheduleDecision } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const device = buildDevice();
    device.meta.sleepTime = String(sleepTime);
    const wakeup = new Date("2026-06-01T08:00:00Z"); // 10:00 Berlin
    const decision = getDeviceUpdateScheduleDecision({
      device, deviceStatus: { nextDeviceSync: wakeup.toISOString() },
      now: new Date("2026-06-01T07:55:00Z"),
    });
    expect(decision.action).not.toBe("skip");
    if (decision.action === "skip") throw new Error("Expected a sleep decision");
    expect(new Date(wakeup.getTime() + decision.sleepTime * 1000).toISOString()).toBe(new Date(expected).toISOString());
  });

  it("treats the end of a window as excluded and maintains the boundary over successive cycles", async () => {
    const { getDeviceUpdateScheduleDecision } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const device = buildDevice();
    device.meta.sleepTime = "3600";
    let wakeup = new Date("2026-06-01T06:00:00Z"); // 08:00 Berlin
    const nextWakeups: string[] = [];
    for (let cycle = 0; cycle < 9; cycle++) {
      const decision = getDeviceUpdateScheduleDecision({ device, deviceStatus: { nextDeviceSync: wakeup }, now: wakeup });
      if (decision.action === "skip") throw new Error("Expected a sleep decision");
      wakeup = new Date(wakeup.getTime() + decision.sleepTime * 1000);
      nextWakeups.push(wakeup.toISOString());
    }
    expect(nextWakeups).toEqual([
      "2026-06-01T07:00:00.000Z", "2026-06-01T08:00:00.000Z",
      "2026-06-01T09:00:00.000Z", "2026-06-01T10:00:00.000Z",
      "2026-06-01T11:00:00.000Z", "2026-06-01T12:00:00.000Z",
      "2026-06-01T13:00:00.000Z", "2026-06-01T14:00:00.000Z",
      "2026-06-02T06:00:00.000Z",
    ]);
  });

  it("does not restore an interval crossing closing time during an early cron run", async () => {
    const { getDeviceUpdateScheduleDecision } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const device = buildDevice();
    device.meta.sleepTime = "28800";
    const decision = getDeviceUpdateScheduleDecision({ device,
      deviceStatus: { nextDeviceSync: "2026-06-02T08:00:00Z" },
      now: new Date("2026-06-01T16:00:00Z"),
    });
    expect(decision).toMatchObject({ action: "defer", sleepTime: 22 * 3600, nextAllowedAt: "2026-06-03T06:00:00.000Z" });
  });

  it.each([
    [2 * 3600, 3 * 3600], // 12:00 is in the lunch gap: wait until 13:00.
    [3 * 3600, 3 * 3600], // 13:00 is exactly the next allowed start.
    [4 * 3600, 4 * 3600], // 14:00 is allowed: keep the normal interval.
  ])("checks all windows without shortening a %s-second interval", async (sleepTime, expectedSleep) => {
    const { getDeviceUpdateScheduleDecision } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const device = buildDevice();
    device.meta.sleepTime = String(sleepTime);
    device.meta.updateSchedule.windows = [
      { id: "morning", startsAt: "2026-06-01T06:00:00Z", durationMinutes: 4 * 60, repeat: "daily", rrule: buildDailyRrule("2026-06-01", "08:00") },
      { id: "afternoon", startsAt: "2026-06-01T11:00:00Z", durationMinutes: 4 * 60, repeat: "daily", rrule: buildDailyRrule("2026-06-01", "13:00") },
    ];
    const decision = getDeviceUpdateScheduleDecision({ device, deviceStatus: { nextDeviceSync: "2026-06-01T08:00:00Z" }, now: new Date("2026-06-01T08:00:00Z") });
    expect(decision).toMatchObject({ sleepTime: expectedSleep });
  });

  it("moves a Friday interval past closing time to Monday morning", async () => {
    const { getDeviceUpdateScheduleDecision } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const device = buildDevice();
    device.meta.sleepTime = "7200";
    device.meta.updateSchedule.windows[0].rrule = "DTSTART;TZID=Europe/Berlin:20260601T080000\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    const decision = getDeviceUpdateScheduleDecision({ device, deviceStatus: { nextDeviceSync: "2026-06-05T14:00:00Z" }, now: new Date("2026-06-05T14:00:00Z") });
    expect(decision).toMatchObject({ action: "defer", sleepTime: 64 * 3600, nextAllowedAt: "2026-06-08T06:00:00.000Z" });
  });

  it.each([
    ["20260328", "2026-03-28T15:30:00Z", 14.5 * 3600],
    ["20261024", "2026-10-24T14:30:00Z", 16.5 * 3600],
  ])("moves a boundary-crossing interval to 08:00 across the clock change on %s", async (day, wakeup, expectedSleep) => {
    const { getDeviceUpdateScheduleDecision } = await import("../../src/cronjobs/deviceUpdateSchedule.cronjob");
    const device = buildDevice();
    device.meta.sleepTime = "3600";
    device.meta.updateSchedule.windows[0].rrule = `DTSTART;TZID=Europe/Berlin:${day}T080000\nRRULE:FREQ=DAILY`;
    const decision = getDeviceUpdateScheduleDecision({ device, deviceStatus: { nextDeviceSync: wakeup }, now: new Date(wakeup) });
    expect(decision).toMatchObject({ action: "defer", sleepTime: expectedSleep });
  });

  it("does not restore a stale allowed wakeup from the distant past", async () => {
    const { getDeviceUpdateScheduleDecision } = await import(
      "../../src/cronjobs/deviceUpdateSchedule.cronjob"
    );

    const decision = getDeviceUpdateScheduleDecision({
      device: buildDevice(),
      deviceStatus: { nextDeviceSync: "2026-06-01T07:00:00.000Z" },
      now: new Date("2026-06-01T16:10:00.000Z"),
    });

    expect(decision).toEqual({
      action: "skip",
      reason: "outside-check-window",
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
            sleepTime: 50400,
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
