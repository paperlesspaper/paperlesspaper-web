import rrule from "rrule";
import { fromZonedTime } from "date-fns-tz";
import { devicesService, iotDevicesService } from "@internetderdinge/api";

import type { Job } from "bullmq";

const { rrulestr } = rrule;

const EPAPER_KINDS = ["epaper", "epd7", "openpaper13", "epaper-13"];
const DEFAULT_TIMEZONE = "Europe/Berlin";
const PARKING_SLEEP_SECONDS = 24 * 60 * 60;
const LOOKAHEAD_MINUTES = 10;
const LOOKBEHIND_MINUTES = 1;
const SEARCH_HORIZON_DAYS = 366;

type RepeatKind = "none" | "daily" | "weekly" | "monthly";

export type UpdateScheduleWindow = {
  id?: string;
  startsAt?: string;
  durationMinutes?: number;
  repeat?: RepeatKind;
  rrule?: string;
};

export type UpdateSchedule = {
  enabled?: boolean;
  timezone?: string;
  windows?: UpdateScheduleWindow[];
};

type WindowInterval = {
  start: Date;
  end: Date;
  window: UpdateScheduleWindow;
};

export type DeviceUpdateScheduleDecision =
  | {
      action: "restore";
      sleepTime: number;
      reason: "inside-window";
    }
  | {
      action: "defer";
      sleepTime: number;
      nextAllowedAt?: string;
      reason: "outside-window" | "no-windows";
    }
  | {
      action: "skip";
      reason: "outside-check-window" | "invalid-wakeup" | "disabled";
    };

const getTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const timestamp =
    typeof value === "number" ? value : new Date(value as string).getTime();

  if (!Number.isFinite(timestamp)) return null;

  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
};

const getNormalSleepTime = (device: any) => {
  const sleepTime = parseInt(device?.meta?.sleepTime, 10);
  return Number.isFinite(sleepTime) && sleepTime > 0 ? sleepTime : 3600;
};

const getScheduleTimezone = (device: any, schedule?: UpdateSchedule) =>
  schedule?.timezone || device?.timezone || DEFAULT_TIMEZONE;

const getWindowDurationMs = (window: UpdateScheduleWindow) => {
  const durationMinutes = Number(window.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  return durationMinutes * 60 * 1000;
};

const toFloatingLocalString = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-") +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
      date.getUTCSeconds(),
    )}`;
};

const rruleDateToInstant = (date: Date, timezone: string) =>
  fromZonedTime(toFloatingLocalString(date), timezone);

const uniqueIntervals = (intervals: WindowInterval[]) => {
  const seen = new Set<string>();
  return intervals
    .filter((interval) => {
      const key = `${interval.start.getTime()}:${interval.end.getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};

export const getAllowedIntervals = ({
  windows,
  rangeStart,
  rangeEnd,
  timezone,
}: {
  windows: UpdateScheduleWindow[];
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
}): WindowInterval[] => {
  const intervals = windows.flatMap((window) => {
    const durationMs = getWindowDurationMs(window);
    if (!durationMs) return [];

    if (window.rrule) {
      try {
        const rule = rrulestr(window.rrule);
        const expansionStart = new Date(rangeStart.getTime() - durationMs);
        const expansionEnd = new Date(rangeEnd.getTime() + durationMs);
        return rule
          .between(expansionStart, expansionEnd, true)
          .map((occurrence: Date) => {
            const start = window.rrule?.includes("TZID=")
              ? rruleDateToInstant(occurrence, timezone)
              : occurrence;
            return {
              start,
              end: new Date(start.getTime() + durationMs),
              window,
            };
          });
      } catch (error) {
        console.warn("Invalid update schedule rrule", {
          rrule: window.rrule,
          message: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    }

    const startsAtTimestamp = getTimestamp(window.startsAt);
    if (!startsAtTimestamp) return [];

    const start = new Date(startsAtTimestamp);
    return [
      {
        start,
        end: new Date(start.getTime() + durationMs),
        window,
      },
    ];
  });

  return uniqueIntervals(intervals).filter(
    (interval) =>
      interval.end.getTime() > rangeStart.getTime() &&
      interval.start.getTime() < rangeEnd.getTime(),
  );
};

export const getDeviceUpdateScheduleDecision = ({
  device,
  deviceStatus,
  now = new Date(),
}: {
  device: any;
  deviceStatus: any;
  now?: Date;
}): DeviceUpdateScheduleDecision => {
  const schedule = device?.meta?.updateSchedule as UpdateSchedule | undefined;
  if (schedule?.enabled !== true) return { action: "skip", reason: "disabled" };

  const nextWakeupTimestamp = getTimestamp(deviceStatus?.nextDeviceSync);
  if (!nextWakeupTimestamp) {
    return { action: "skip", reason: "invalid-wakeup" };
  }

  const checkStart = now.getTime() - LOOKBEHIND_MINUTES * 60 * 1000;
  const checkEnd = now.getTime() + LOOKAHEAD_MINUTES * 60 * 1000;
  if (nextWakeupTimestamp < checkStart || nextWakeupTimestamp > checkEnd) {
    return { action: "skip", reason: "outside-check-window" };
  }

  const windows = Array.isArray(schedule.windows) ? schedule.windows : [];
  if (!windows.length) {
    return {
      action: "defer",
      sleepTime: PARKING_SLEEP_SECONDS,
      reason: "no-windows",
    };
  }

  const timezone = getScheduleTimezone(device, schedule);
  const nextWakeup = new Date(nextWakeupTimestamp);
  const searchStart = new Date(nextWakeup.getTime() - PARKING_SLEEP_SECONDS);
  const searchEnd = new Date(
    nextWakeup.getTime() + SEARCH_HORIZON_DAYS * PARKING_SLEEP_SECONDS * 1000,
  );
  const intervals = getAllowedIntervals({
    windows,
    rangeStart: searchStart,
    rangeEnd: searchEnd,
    timezone,
  });

  const isInsideAllowedWindow = intervals.some(
    (interval) =>
      interval.start.getTime() <= nextWakeupTimestamp &&
      interval.end.getTime() > nextWakeupTimestamp,
  );

  if (isInsideAllowedWindow) {
    return {
      action: "restore",
      sleepTime: getNormalSleepTime(device),
      reason: "inside-window",
    };
  }

  const nextAllowedInterval = intervals.find(
    (interval) => interval.start.getTime() > nextWakeupTimestamp,
  );

  if (!nextAllowedInterval) {
    return {
      action: "defer",
      sleepTime: PARKING_SLEEP_SECONDS,
      reason: "outside-window",
    };
  }

  return {
    action: "defer",
    sleepTime: Math.max(
      60,
      Math.ceil((nextAllowedInterval.start.getTime() - now.getTime()) / 1000),
    ),
    nextAllowedAt: nextAllowedInterval.start.toISOString(),
    reason: "outside-window",
  };
};

const updateDeviceSleepTime = async (deviceId: string, sleepTime: number) => {
  return iotDevicesService.shadowAlarmUpdate(
    deviceId,
    {
      state: {
        reported: {
          sleepTime,
        },
      },
    },
    "settings",
  );
};

export const cronjobDeviceUpdateSchedule = async (
  job?: Job,
): Promise<{
  results: any[];
  meta: {
    job: { id?: string; name?: string };
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    devices: {
      totalFetched: number;
      processed: number;
      skipped: number;
      updated: number;
    };
    errors: Array<{ deviceId?: string; message: string }>;
  };
}> => {
  const startedAt = new Date();
  const results: any[] = [];
  const errors: Array<{ deviceId?: string; message: string }> = [];
  const metrics = {
    totalFetched: 0,
    processed: 0,
    skipped: 0,
    updated: 0,
  };

  const devices = await devicesService.queryDevicesByUser(
    {
      kind: { $in: EPAPER_KINDS },
      "meta.updateSchedule.enabled": true,
    },
    { limit: -1 },
  );

  metrics.totalFetched = devices.results.length;

  await Promise.all(
    devices.results.map(async (device: any) => {
      if (!device.deviceId) {
        metrics.skipped += 1;
        return;
      }

      metrics.processed += 1;

      try {
        const deviceStatus = await devicesService.populateDeviceStatus(device);
        const decision = getDeviceUpdateScheduleDecision({
          device,
          deviceStatus,
          now: startedAt,
        });

        if (decision.action === "skip") {
          metrics.skipped += 1;
          results.push({
            deviceId: device.deviceId,
            action: decision.action,
            reason: decision.reason,
          });
          return;
        }

        const updateResult = await updateDeviceSleepTime(
          device.deviceId,
          decision.sleepTime,
        );
        metrics.updated += 1;
        results.push({
          deviceId: device.deviceId,
          action: decision.action,
          reason: decision.reason,
          sleepTime: decision.sleepTime,
          nextAllowedAt:
            decision.action === "defer" ? decision.nextAllowedAt : undefined,
          updateResult,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown processing error";
        errors.push({
          deviceId: device.deviceId,
          message,
        });
      }
    }),
  );

  const finishedAt = new Date();

  return {
    results,
    meta: {
      job: {
        id: job?.id,
        name: job?.name,
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      devices: metrics,
      errors,
    },
  };
};

export default cronjobDeviceUpdateSchedule;
