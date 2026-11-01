import { createHash, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { Device, getAuth0Token } from "@internetderdinge/api";
import Papers from "../papers/papers.model";
import DevicesLogs from "../devicesLogs/devicesLogs.model";
import { normalizeTimestamp } from "../utils/normalizeTimestamp";
import { withDeadline } from "../utils/withDeadline";
import { getAllowedIntervals } from "../cronjobs/deviceUpdateSchedule.cronjob";
import { slideshowPreparationMinutes } from "../utils/slideshowTiming";

export function authorizedMonitor(
  header: unknown,
  secret = process.env.SLIDESHOW_MONITOR_TOKEN
) {
  if (!secret || secret.length < 32 || typeof header !== "string") return false;
  return timingSafeEqual(
    createHash("sha256").update(header).digest(),
    createHash("sha256").update(`Bearer ${secret}`).digest()
  );
}

const iso = (value: unknown) => {
  const ms = normalizeTimestamp(value);
  return ms !== null && ms > 0 ? new Date(ms).toISOString() : null;
};

// Whitelist fields: never return raw IoT responses, image URLs, settings or errors.
export function safeTelemetry(raw: any) {
  return {
    nextDeviceSync: iso(raw?.nextDeviceSync),
    lastReachableAt: iso(raw?.lastReachableAgo),
    fileVersion: iso(raw?.fileVersion),
    pictureSynced:
      typeof raw?.pictureSynced === "boolean" ? raw.pictureSynced : null,
  };
}

export function safeAttempt(log: any) {
  return {
    attemptId: String(log.attemptId),
    trigger: String(log.trigger),
    paperId: log.paperId ? String(log.paperId) : null,
    sourcePaperId:
      typeof log.triggerMetadata?.sourcePaperId === "string"
        ? log.triggerMetadata.sourcePaperId
        : null,
    status: log.status,
    identical:
      log.status === "skipped" && log.reason === "similarity-threshold-met",
    startedAt: iso(log.startedAt),
    finishedAt: iso(log.finishedAt),
  };
}

export async function slideshowSnapshot(after?: string) {
  if (after && !/^[a-f0-9]{24}$/i.test(after))
    throw new Error("Invalid cursor");
  const pageSize = 20;
  const rows = await Device.aggregate([
    {
      $match: {
        kind: { $in: ["epaper", "epd7", "openpaper13", "epaper-13"] },
        ...(after ? { _id: { $gt: new mongoose.Types.ObjectId(after) } } : {}),
      },
    },
    { $sort: { _id: 1 } },
    {
      $lookup: {
        from: Papers.collection.name,
        localField: "paper",
        foreignField: "_id",
        as: "slideshow",
      },
    },
    { $unwind: "$slideshow" },
    { $match: { "slideshow.kind": "slides" } },
    { $limit: pageSize + 1 },
    {
      $project: {
        deviceId: 1,
        organization: 1,
        paper: 1,
        kind: 1,
        timezone: 1,
        "meta.sleepTime": 1,
        "meta.updateSchedule": 1,
        "meta.paperCronjobSync": 1,
        "slideshow.organization": 1,
        "slideshow.meta.selectedPapers": 1,
        "slideshow.meta.order": 1,
      },
    },
  ]).option({ maxTimeMS: 10_000 });
  const page = rows.slice(0, pageSize);
  const now = new Date();
  let token: string | undefined;
  if (page.length) {
    try {
      token = await withDeadline(
        () => getAuth0Token(),
        "Monitor IoT authentication",
        10_000
      );
    } catch {
      /* Each row reports unknown telemetry; no false healthy result. */
    }
  }
  const results: any[] = [];
  // Four read-only IoT requests at a time, with cancellation and bounded DB work.
  for (let offset = 0; offset < page.length; offset += 4) {
    results.push(
      ...(await Promise.all(
        page.slice(offset, offset + 4).map(async (device: any) => {
          const selected = Object.entries(
            device.slideshow.meta?.selectedPapers || {}
          )
            .filter(([, enabled]) => enabled === true)
            .map(([id]) => id);
          const validIds = selected.filter((id) =>
            mongoose.isValidObjectId(id)
          );
          const [sources, logs] = await Promise.all([
            Papers.find({
              _id: { $in: validIds },
              organization: device.organization,
            })
              .select("_id")
              .lean()
              .maxTimeMS(10_000),
            DevicesLogs.find({ deviceId: String(device._id) })
              .sort({ startedAt: -1 })
              .limit(21)
              .select(
                "attemptId trigger paperId triggerMetadata.sourcePaperId status reason startedAt finishedAt"
              )
              .lean()
              .maxTimeMS(10_000),
          ]);
          let telemetry = safeTelemetry(null);
          if (token && device.deviceId && process.env.IOT_API_URL_EPAPER) {
            try {
              const url = new URL(
                "getdevicestatus",
                process.env.IOT_API_URL_EPAPER.replace(/\/?$/, "/")
              );
              url.searchParams.set("DeviceId", device.deviceId);
              const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(10_000),
                redirect: "error",
              });
              if (response.ok) telemetry = safeTelemetry(await response.json());
            } catch {
              /* Deliberately omit upstream error bodies and credentials. */
            }
          }
          const schedule = device.meta?.updateSchedule;
          let allowedWindows: { start: string; end: string }[] | null = null;
          let scheduleError = false;
          if (schedule?.enabled) {
            try {
              allowedWindows = getAllowedIntervals({
                windows: schedule.windows || [],
                rangeStart: new Date(now.getTime() - 86400_000),
                rangeEnd: new Date(now.getTime() + 7 * 86400_000),
                timezone:
                  schedule.timezone || device.timezone || "Europe/Berlin",
              }).map((w) => ({
                start: w.start.toISOString(),
                end: w.end.toISOString(),
              }));
            } catch {
              scheduleError = true;
            }
          }
          const claim = device.meta?.paperCronjobSync;
          const configuration = {
            paperId: String(device.paper),
            selected: [...selected].sort(),
            sleepTime: device.meta?.sleepTime,
            schedule,
            order: device.slideshow.meta?.order,
          };
          return {
            deviceId: String(device._id),
            deviceName: device.deviceId || String(device._id),
            organizationId: String(device.organization),
            slideshowId: String(device.paper),
            configuration: createHash("sha256")
              .update(JSON.stringify(configuration))
              .digest("hex"),
            organizationMatches:
              String(device.organization) ===
              String(device.slideshow.organization),
            selectedCount: selected.length,
            sourceIds: sources.map((s: any) => String(s._id)),
            intervalSeconds:
              Number(device.meta?.sleepTime) > 0
                ? Number(device.meta.sleepTime)
                : null,
            preparationAheadSeconds:
              slideshowPreparationMinutes(device.meta?.sleepTime) * 60,
            allowedWindows,
            scheduleError,
            telemetry,
            claim:
              claim?.paperId === String(device.paper)
                ? {
                    status: claim.status,
                    dueAt: iso(claim.nextDeviceSync),
                    claimedAt: iso(claim.claimedAt),
                    completedAt: iso(claim.completedAt),
                  }
                : null,
            attempts: logs.slice(0, 20).map(safeAttempt),
            historyTruncated: logs.length > 20,
          };
        })
      ))
    );
  }
  return {
    schemaVersion: 1,
    checkedAt: now.toISOString(),
    results,
    nextCursor: rows.length > pageSize ? String(page.at(-1)._id) : null,
  };
}
