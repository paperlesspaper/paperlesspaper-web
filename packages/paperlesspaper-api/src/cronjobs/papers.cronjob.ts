import { setTimeout as delay } from "node:timers/promises";
import { Device as DeviceModel, devicesService } from "@internetderdinge/api";
import papersService from "../papers/papers.service.ts";
// import Messages from "../messages/messages.service.ts";

type CronJob = {
  id?: string;
  name?: string;
  data?: { dryRun?: boolean };
};
type Device = any;
type Paper = any;

const DEVICE_BATCH_SIZE = 300;
const DEVICE_STATUS_MAX_ATTEMPTS = 3;
const DEVICE_STATUS_RETRY_DELAY_MS = 200;
const PREPARE_AHEAD_MINUTES = 5;
const LATE_SYNC_GRACE_MINUTES = 0.5;
const SYNC_CLAIM_STALE_AFTER_MINUTES = 15;
const SYNC_CLAIM_META_KEY = "paperCronjobSync";

type SyncClaimState = {
  nextDeviceSync: string;
  paperId: string;
  status: "processing" | "completed";
  jobId?: string;
  claimedAt: Date;
  completedAt?: Date;
};

const getTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const timestamp =
    typeof value === "number" ? value : new Date(value as string).getTime();
  if (!Number.isFinite(timestamp)) return null;

  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
};

const getDeviceStatusWithRetry = async (device: Device) => {
  for (let attempt = 1; attempt <= DEVICE_STATUS_MAX_ATTEMPTS; attempt += 1) {
    const deviceStatus = await devicesService.populateDeviceStatus(device);
    const nextDeviceSyncTimestamp = getTimestamp(deviceStatus?.nextDeviceSync);

    if (nextDeviceSyncTimestamp !== null) {
      return { deviceStatus, nextDeviceSyncTimestamp };
    }

    if (attempt < DEVICE_STATUS_MAX_ATTEMPTS) {
      await delay(DEVICE_STATUS_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(
    `Device status is missing a valid nextDeviceSync after ${DEVICE_STATUS_MAX_ATTEMPTS} attempts`,
  );
};

const setLocalSyncClaim = (device: Device, state?: SyncClaimState) => {
  const nextMeta = { ...(device.meta || {}) };
  if (state) {
    nextMeta[SYNC_CLAIM_META_KEY] = state;
  } else {
    delete nextMeta[SYNC_CLAIM_META_KEY];
  }
  device.meta = nextMeta;
  device.markModified?.("meta");
};

const claimDeviceSync = async ({
  device,
  paperId,
  nextDeviceSync,
  jobId,
  now,
}: {
  device: Device;
  paperId: string;
  nextDeviceSync: string;
  jobId?: string;
  now: Date;
}): Promise<boolean> => {
  const deviceId = device._id?.toString?.() || device.id?.toString?.();
  if (!deviceId) {
    throw new Error("Device is missing its database id");
  }

  const metaPath = `meta.${SYNC_CLAIM_META_KEY}`;
  const staleBefore = new Date(
    now.getTime() - SYNC_CLAIM_STALE_AFTER_MINUTES * 60 * 1000,
  );
  const state: SyncClaimState = {
    nextDeviceSync,
    paperId,
    status: "processing",
    jobId,
    claimedAt: now,
  };

  const claimedDevice = await DeviceModel.findOneAndUpdate(
    {
      _id: deviceId,
      $or: [
        { [`${metaPath}.nextDeviceSync`]: { $ne: nextDeviceSync } },
        {
          [`${metaPath}.nextDeviceSync`]: nextDeviceSync,
          [`${metaPath}.status`]: "processing",
          [`${metaPath}.claimedAt`]: { $lt: staleBefore },
        },
      ],
    },
    { $set: { [metaPath]: state } },
    { new: true, projection: { _id: 1 } },
  );

  if (!claimedDevice) return false;

  // Upload helpers may save the same in-memory device later. Keep the local
  // object in sync so that such a save cannot accidentally remove the claim.
  setLocalSyncClaim(device, state);
  return true;
};

const completeDeviceSyncClaim = async ({
  device,
  nextDeviceSync,
}: {
  device: Device;
  nextDeviceSync: string;
}) => {
  const deviceId = device._id?.toString?.() || device.id?.toString?.();
  if (!deviceId) return;

  const metaPath = `meta.${SYNC_CLAIM_META_KEY}`;
  const completedAt = new Date();
  await DeviceModel.updateOne(
    {
      _id: deviceId,
      [`${metaPath}.nextDeviceSync`]: nextDeviceSync,
    },
    {
      $set: {
        [`${metaPath}.status`]: "completed",
        [`${metaPath}.completedAt`]: completedAt,
      },
    },
  );

  const currentState = device.meta?.[SYNC_CLAIM_META_KEY];
  if (currentState?.nextDeviceSync === nextDeviceSync) {
    setLocalSyncClaim(device, {
      ...currentState,
      status: "completed",
      completedAt,
    });
  }
};

const releaseDeviceSyncClaim = async ({
  device,
  nextDeviceSync,
}: {
  device: Device;
  nextDeviceSync: string;
}) => {
  const deviceId = device._id?.toString?.() || device.id?.toString?.();
  if (!deviceId) return;

  const metaPath = `meta.${SYNC_CLAIM_META_KEY}`;
  await DeviceModel.updateOne(
    {
      _id: deviceId,
      [`${metaPath}.nextDeviceSync`]: nextDeviceSync,
      [`${metaPath}.status`]: "processing",
    },
    { $unset: { [metaPath]: "" } },
  );

  if (device.meta?.[SYNC_CLAIM_META_KEY]?.nextDeviceSync === nextDeviceSync) {
    setLocalSyncClaim(device);
  }
};

const validation = async (entry: any): Promise<any> => {
  /* const jobs = await Messages.findMessage({
    name: "sendPushNotification",
    "data.original._id": entry.original._id,
    "data.organization": entry.organization,
    "data.kind": entry.kind,
    lastRunAt: {
      $gt: subHours(new Date(), 48),
    },
  });
  return jobs; */ return false;
};

export const cronjobPapers = async (
  job: CronJob,
): Promise<{
  results: any[];
  validation: typeof validation;
  meta: {
    job: { id?: string; name?: string };
    dryRun: boolean;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    batchSize: number;
    devices: {
      totalFetched: number;
      processed: number;
      skippedNoDeviceId: number;
      withPaper: number;
      nonImagePaper: number;
      statusUnavailable: number;
      outsideSyncWindow: number;
      alreadyPrepared: number;
      dueForSync: number;
    };
    actions: {
      uploadsTriggered: number;
      slidesAdvanced: number;
      singleImageUploads: number;
    };
    updatedEntries: Array<{
      deviceId: string;
      organizationId?: string;
      paperId?: string;
      action: "slides" | "playlist" | "single-image" | "dynamic-integration";
      updateResult?: unknown;
    }>;
    errors: Array<{ deviceId?: string; message: string }>;
  };
}> => {
  const startedAt = new Date();
  const dryRun = job?.data?.dryRun === true;
  console.log("run Papers Cronjob");
  const notifications: any[] = [];
  const errors: Array<{ deviceId?: string; message: string }> = [];
  const updatedEntries: Array<{
    deviceId: string;
    organizationId?: string;
    paperId?: string;
    action: "slides" | "playlist" | "single-image" | "dynamic-integration";
    updateResult?: unknown;
  }> = [];

  const metrics = {
    totalFetched: 0,
    processed: 0,
    skippedNoDeviceId: 0,
    withPaper: 0,
    nonImagePaper: 0,
    statusUnavailable: 0,
    outsideSyncWindow: 0,
    alreadyPrepared: 0,
    dueForSync: 0,
    uploadsTriggered: 0,
    slidesAdvanced: 0,
    singleImageUploads: 0,
  };

  const devices = await devicesService.queryDevicesByUser(
    {
      kind: { $in: ["epaper", "epd7", "openpaper13"] },
    },
    { limit: -1 },
  );
  metrics.totalFetched = devices.results.length;

  const paperIds = devices.results
    .map((device: Device) => device.paper?.toString())
    .filter(Boolean);
  const papers = await papersService.getByIds(paperIds);
  const papersById = new Map(
    papers.map((paper: Paper) => [paper._id?.toString(), paper]),
  );

  const processDevice = async (device: Device) => {
    // console.log('Checking device for new papers:', device._id);
    // TODO: Remove hardcoded device ID

    if (!device.deviceId) {
      metrics.skippedNoDeviceId += 1;
      return;
    }

    metrics.processed += 1;

    try {
      const resultPaperId = device.paper?.toString();
      const resultPaper: Paper | undefined = resultPaperId
        ? papersById.get(resultPaperId)
        : undefined;
      // Additional guard to check if the paper's organization matches the device's organization before proceeding with processing
      if (
        resultPaper &&
        resultPaper.organization?.toString() === device.organization?.toString()
      ) {
        metrics.withPaper += 1;

        if (resultPaper.kind !== "image") {
          metrics.nonImagePaper += 1;
          let nextDeviceSyncTimestamp: number;
          try {
            ({ nextDeviceSyncTimestamp } = await getDeviceStatusWithRetry(
              device,
            ));
          } catch (error) {
            metrics.statusUnavailable += 1;
            throw error;
          }

          const now = new Date();
          const differenceInMinutes =
            (nextDeviceSyncTimestamp - now.getTime()) / 1000 / 60;

          if (
            differenceInMinutes > PREPARE_AHEAD_MINUTES ||
            differenceInMinutes < -LATE_SYNC_GRACE_MINUTES
          ) {
            metrics.outsideSyncWindow += 1;
            return;
          }

          const nextDeviceSync = new Date(
            nextDeviceSyncTimestamp,
          ).toISOString();
          const paperId = resultPaper._id?.toString();
          if (!paperId) {
            throw new Error("Paper is missing its database id");
          }

          if (dryRun) {
            metrics.dueForSync += 1;
            const action =
              resultPaper.kind === "slides"
                ? "slides"
                : resultPaper.kind === "playlist"
                ? "playlist"
                : "dynamic-integration";
            updatedEntries.push({
              deviceId: device.id,
              organizationId: device.organization?.toString(),
              paperId,
              action,
              updateResult: {
                dryRun: true,
                nextDeviceSync,
                differenceInMinutes,
              },
            });
            return;
          }

          const claimed = await claimDeviceSync({
            device,
            paperId,
            nextDeviceSync,
            jobId: job?.id,
            now,
          });
          if (!claimed) {
            metrics.alreadyPrepared += 1;
            return;
          }

          metrics.dueForSync += 1;
          let contentPrepared = false;
          try {
            if (resultPaper.kind === "slides") {
              metrics.uploadsTriggered += 1;
              metrics.slidesAdvanced += 1;
              const updateNextSlideResult = await papersService.updateNextSlide(
                resultPaper,
                device,
                "cronjob-slideshow",
              );
              updatedEntries.push({
                deviceId: device.id,
                organizationId: device.organization?.toString(),
                paperId,
                action: "slides",
                updateResult: updateNextSlideResult,
              });
            } else if (resultPaper.kind === "playlist") {
              metrics.uploadsTriggered += 1;
              metrics.singleImageUploads += 1;
              const updatePlaylistResult = await papersService.updatePlaylist(
                resultPaper,
                device,
                "cronjob-playlist",
              );
              updatedEntries.push({
                deviceId: device.id,
                organizationId: device.organization?.toString(),
                paperId,
                action: "playlist",
                updateResult: updatePlaylistResult,
              });
            } else {
              metrics.uploadsTriggered += 1;
              metrics.singleImageUploads += 1;
              const uploadSingleImageFromWebsiteResult =
                await papersService.uploadSingleImageFromWebsite({
                  paperId: resultPaper._id,
                  device,
                  trigger: "cronjob-dynamic-integration",
                });
              updatedEntries.push({
                deviceId: device.id,
                organizationId: device.organization?.toString(),
                paperId,
                action: "dynamic-integration",
                updateResult: uploadSingleImageFromWebsiteResult,
              });
            }

            contentPrepared = true;
            await completeDeviceSyncClaim({ device, nextDeviceSync });
          } catch (error) {
            if (!contentPrepared) {
              await releaseDeviceSyncClaim({ device, nextDeviceSync });
            }
            throw error;
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";
      errors.push({
        deviceId: device.deviceId,
        message,
      });
    }
  };

  console.log(
    `Processing ${devices.results.length} devices in batches of ${DEVICE_BATCH_SIZE}...`,
  );

  for (let i = 0; i < devices.results.length; i += DEVICE_BATCH_SIZE) {
    const batch = devices.results.slice(i, i + DEVICE_BATCH_SIZE);

    console.log(
      `Processing batch ${i / DEVICE_BATCH_SIZE + 1} (${
        batch.length
      } devices)...`,
    );
    await Promise.all(batch.map(processDevice));
  }

  const finishedAt = new Date();

  return {
    results: notifications,
    validation,
    meta: {
      job: {
        id: job?.id,
        name: job?.name,
      },
      dryRun,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      batchSize: DEVICE_BATCH_SIZE,
      devices: {
        totalFetched: metrics.totalFetched,
        processed: metrics.processed,
        skippedNoDeviceId: metrics.skippedNoDeviceId,
        withPaper: metrics.withPaper,
        nonImagePaper: metrics.nonImagePaper,
        statusUnavailable: metrics.statusUnavailable,
        outsideSyncWindow: metrics.outsideSyncWindow,
        alreadyPrepared: metrics.alreadyPrepared,
        dueForSync: metrics.dueForSync,
      },
      actions: {
        uploadsTriggered: metrics.uploadsTriggered,
        slidesAdvanced: metrics.slidesAdvanced,
        singleImageUploads: metrics.singleImageUploads,
      },
      updatedEntries,
      errors,
    },
  };
};

export default {
  cronjobPapers,
};
