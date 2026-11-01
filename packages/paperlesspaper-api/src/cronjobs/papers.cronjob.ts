import { normalizeTimestamp as getTimestamp } from "../utils/normalizeTimestamp";
import { setTimeout as delay } from "node:timers/promises";
import { Device as DeviceModel, devicesService } from "@internetderdinge/api";
import papersService from "../papers/papers.service.ts";
import { createHash, randomUUID } from "node:crypto";
import { slideshowPreparationMinutes } from "../utils/slideshowTiming";
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
const DEVICE_STATUS_REQUEST_TIMEOUT_MS = 10_000;
const PREPARE_AHEAD_MINUTES = 5;
const SYNC_CLAIM_STALE_AFTER_MINUTES = 15;
const SYNC_CLAIM_META_KEY = "paperCronjobSync";

type SyncClaimState = {
  nextDeviceSync: string;
  paperId: string;
  status: "pending" | "processing" | "completed";
  configuration?: string;
  leaseId?: string;
  jobId?: string;
  claimedAt?: Date;
  completedAt?: Date;
  coveredThrough?: string;
};

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const getDeviceStatusWithRetry = async (device: Device) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DEVICE_STATUS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const deviceStatus = await withTimeout(
        devicesService.populateDeviceStatus(device),
        DEVICE_STATUS_REQUEST_TIMEOUT_MS,
        `Device status request timed out after ${DEVICE_STATUS_REQUEST_TIMEOUT_MS}ms`,
      );
      const nextDeviceSyncTimestamp = getTimestamp(
        deviceStatus?.nextDeviceSync,
      );

      if (nextDeviceSyncTimestamp !== null && nextDeviceSyncTimestamp > 0) {
        return { deviceStatus, nextDeviceSyncTimestamp };
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < DEVICE_STATUS_MAX_ATTEMPTS) {
      await delay(DEVICE_STATUS_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(
    `Device status is missing a valid nextDeviceSync after ${DEVICE_STATUS_MAX_ATTEMPTS} attempts${
      lastError instanceof Error ? `: ${lastError.message}` : ""
    }`,
  );
};

const setLocalSyncClaim = (device: Device, state?: SyncClaimState) => {
  const path = `meta.${SYNC_CLAIM_META_KEY}`;
  if (
    typeof device.set === "function" &&
    typeof device.unmarkModified === "function"
  ) {
    // This state was already written atomically. A later document.save() must
    // not persist a stale lease or overwrite concurrently changed settings.
    const metaWasDirty = device.isDirectModified("meta");
    device.set(path, state);
    device.unmarkModified(path);
    if (!metaWasDirty) device.unmarkModified("meta");
    return;
  }
  const nextMeta = { ...(device.meta || {}) };
  if (state) {
    nextMeta[SYNC_CLAIM_META_KEY] = state;
  } else {
    delete nextMeta[SYNC_CLAIM_META_KEY];
  }
  device.meta = nextMeta;
  device.markModified?.("meta");
};

const slideshowSettingsFilter = (device: Device) => ({
  organization: device.organization,
  deviceId: device.deviceId,
  "meta.sleepTime":
    device.meta?.sleepTime === undefined
      ? { $exists: false }
      : device.meta.sleepTime,
  "meta.updateSchedule":
    device.meta?.updateSchedule === undefined
      ? { $exists: false }
      : device.meta.updateSchedule,
});

const slideshowSyncConfiguration = (device: Device, paper: Paper): string => {
  return createHash("sha256")
    .update(
      JSON.stringify({
        paperId: String(paper._id),
        organization: device.organization?.toString(),
        deviceName: device.deviceId,
        interval: device.meta?.sleepTime ?? null,
        schedule: device.meta?.updateSchedule ?? null,
        selected: Object.entries(paper.meta?.selectedPapers || {}).sort(
          ([a], [b]) => a.localeCompare(b),
        ),
        order: paper.meta?.order ?? null,
      }),
    )
    .digest("hex");
};

// Remember the next cycle even outside the preparation window. A device may
// contact us early and replace its reported nextDeviceSync before the next scan.
// One outstanding cycle is retained; we never replay a backlog of old slides.
const rememberSlideshowSync = async (
  device: Device,
  paper: Paper,
  observedSync: string,
  now: Date,
  dryRun: boolean,
): Promise<SyncClaimState | null> => {
  const previous: SyncClaimState | undefined =
    device.meta?.[SYNC_CLAIM_META_KEY];
  const paperId = String(paper._id);
  const configuration = slideshowSyncConfiguration(device, paper);
  const sameConfiguration =
    previous?.paperId === paperId &&
    (!previous.configuration || previous.configuration === configuration);
  const previousTime = getTimestamp(previous?.nextDeviceSync);
  if (
    sameConfiguration &&
    previousTime !== null &&
    ((previous?.status === "pending" &&
      previousTime <= Date.parse(observedSync)) ||
      previous?.status === "processing" ||
      (previous?.status === "completed" &&
        Math.max(
          previousTime,
          getTimestamp(previous.coveredThrough) ?? previousTime,
        ) >= Date.parse(observedSync)))
  )
    return previous!;

  // A content/settings change must not overwrite another worker's active lease.
  if (
    previous?.status === "processing" &&
    (getTimestamp(previous.claimedAt) ?? now.getTime()) >=
      now.getTime() - SYNC_CLAIM_STALE_AFTER_MINUTES * 60_000
  )
    return null;

  const state: SyncClaimState = {
    nextDeviceSync: observedSync,
    paperId,
    configuration,
    status: "pending",
  };
  if (dryRun) return state;
  const result = await DeviceModel.updateOne(
    {
      _id: device._id || device.id,
      paper: paperId,
      ...slideshowSettingsFilter(device),
      // Compare-and-set: a stale scan cannot replace another worker's cycle.
      [`meta.${SYNC_CLAIM_META_KEY}`]: previous ?? { $exists: false },
    },
    { $set: { [`meta.${SYNC_CLAIM_META_KEY}`]: state } },
  );
  if (result.matchedCount !== 1) return null;
  setLocalSyncClaim(device, state);
  return state;
};

const claimDeviceSync = async ({
  device,
  paperId,
  nextDeviceSync,
  jobId,
  now,
  configuration,
  reportedNextDeviceSync,
}: {
  device: Device;
  paperId: string;
  nextDeviceSync: string;
  jobId?: string;
  now: Date;
  configuration?: string;
  reportedNextDeviceSync?: string;
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
    leaseId: randomUUID(),
    ...(configuration ? { configuration } : {}),
    // A catch-up prepared after an early contact serves the *next* contact.
    // Do not overwrite that unseen image while preparing the same next cycle.
    ...(configuration
      ? { coveredThrough: reportedNextDeviceSync || nextDeviceSync }
      : {}),
  };

  const claimedDevice = await DeviceModel.findOneAndUpdate(
    {
      _id: deviceId,
      paper: paperId,
      organization: device.organization,
      deviceId: device.deviceId,
      // A new prediction must not steal a live upload from another worker.
      $and: [
        {
          $or: [
            { [`${metaPath}.status`]: { $ne: "processing" } },
            { [`${metaPath}.claimedAt`]: { $lt: staleBefore } },
          ],
        },
      ],
      // Fence every slideshow state, including stale processing leases. A
      // delayed scan must not resurrect a cycle another worker completed.
      ...(configuration
        ? {
            [metaPath]: device.meta?.[SYNC_CLAIM_META_KEY],
            ...slideshowSettingsFilter(device),
          }
        : {}),
      $or: [
        {
          [`${metaPath}.nextDeviceSync`]: nextDeviceSync,
          [`${metaPath}.status`]: "pending",
        },
        { [`${metaPath}.nextDeviceSync`]: { $ne: nextDeviceSync } },
        {
          [`${metaPath}.paperId`]: { $ne: paperId },
          [`${metaPath}.status`]: "completed",
        },
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
      organization: device.organization,
      deviceId: device.deviceId,
      [`${metaPath}.nextDeviceSync`]: nextDeviceSync,
      [`${metaPath}.leaseId`]: device.meta?.[SYNC_CLAIM_META_KEY]?.leaseId,
      [`${metaPath}.status`]: "processing",
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
      organization: device.organization,
      deviceId: device.deviceId,
      [`${metaPath}.nextDeviceSync`]: nextDeviceSync,
      [`${metaPath}.status`]: "processing",
      [`${metaPath}.leaseId`]: device.meta?.[SYNC_CLAIM_META_KEY]?.leaseId,
    },
    device.meta?.[SYNC_CLAIM_META_KEY]?.configuration
      ? {
          $set: { [`${metaPath}.status`]: "pending" },
          $unset: {
            [`${metaPath}.leaseId`]: "",
            [`${metaPath}.claimedAt`]: "",
          },
        }
      : { $unset: { [metaPath]: "" } },
  );

  if (device.meta?.[SYNC_CLAIM_META_KEY]?.nextDeviceSync === nextDeviceSync) {
    const current = device.meta[SYNC_CLAIM_META_KEY];
    setLocalSyncClaim(
      device,
      current.configuration
        ? {
            ...current,
            status: "pending",
            leaseId: undefined,
            claimedAt: undefined,
          }
        : undefined,
    );
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
        resultPaper.organization && device.organization &&
        resultPaper.organization?.toString() === device.organization?.toString()
      ) {
        metrics.withPaper += 1;

        if (resultPaper.kind !== "image") {
          metrics.nonImagePaper += 1;
          let nextDeviceSyncTimestamp: number;
          try {
            ({ nextDeviceSyncTimestamp } =
              await getDeviceStatusWithRetry(device));
          } catch (error) {
            metrics.statusUnavailable += 1;
            throw error;
          }

          const now = new Date();
          const preparationAheadMinutes =
            resultPaper.kind === "slides"
              ? slideshowPreparationMinutes(device.meta?.sleepTime)
              : PREPARE_AHEAD_MINUTES;
          const reportedNextDeviceSync = new Date(
            nextDeviceSyncTimestamp,
          ).toISOString();
          if (resultPaper.kind === "slides") {
            const remembered = await rememberSlideshowSync(
              device,
              resultPaper,
              reportedNextDeviceSync,
              now,
              dryRun,
            );
            if (!remembered || remembered.status === "completed") {
              metrics.alreadyPrepared += 1;
              return;
            }
            nextDeviceSyncTimestamp = Date.parse(remembered.nextDeviceSync);
          }
          const differenceInMinutes =
            (nextDeviceSyncTimestamp - now.getTime()) / 1000 / 60;

          // A delayed worker (or a reclaimed stale lock) must still prepare a
          // missed sync. The persistent claim below prevents advancing twice
          // while a sleeping/offline device keeps reporting the same sync.
          if (differenceInMinutes > preparationAheadMinutes) {
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
                preparationAheadMinutes,
                reportedNextDeviceSync,
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
            reportedNextDeviceSync,
            configuration:
              resultPaper.kind === "slides"
                ? slideshowSyncConfiguration(device, resultPaper)
                : undefined,
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
              const expectedConfiguration = slideshowSyncConfiguration(device, resultPaper);
              const leaseId = device.meta[SYNC_CLAIM_META_KEY].leaseId;
              // Recheck at the upload boundary too: rendering may outlive an
              // ownership transfer, reassignment, removal or lease takeover.
              const validateTarget = async (verifyRemoteOwner = true) => {
                // IoT activation can move first; local registration completion
                // is a separate operation. Missing proof also fails closed.
                // Remote checks are limited to selection, pre-PUT and post-PUT;
                // intermediate stages still recheck MongoDB without extra IoT calls.
                if (verifyRemoteOwner) {
                  const liveStatus = await withTimeout(
                    devicesService.populateDeviceStatus(device), DEVICE_STATUS_REQUEST_TIMEOUT_MS,
                  );
                  if (liveStatus?.organizationName !== device.organization.toString()) {
                    throw new Error("Slideshow IoT ownership could not be verified; upload cancelled");
                  }
                }
                const assigned = await DeviceModel.exists({
                  _id: device._id || device.id,
                  paper: paperId,
                  ...slideshowSettingsFilter(device),
                  [`meta.${SYNC_CLAIM_META_KEY}.leaseId`]: leaseId,
                  [`meta.${SYNC_CLAIM_META_KEY}.status`]: "processing",
                });
                const current = assigned ? (await papersService.getByIds([paperId]))[0] : null;
                if (!current || current.organization?.toString() !== device.organization?.toString() ||
                    current.kind !== "slides" || slideshowSyncConfiguration(device, current) !== expectedConfiguration) {
                  throw new Error("Slideshow upload assignment changed; upload cancelled");
                }

              };
              const updateNextSlideResult = await papersService.updateNextSlide(
                resultPaper,
                device,
                "cronjob-slideshow",
                validateTarget,
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
                new Date(Math.max(nextDeviceSyncTimestamp, now.getTime())),
              );
              updatedEntries.push({
                deviceId: device.id,
                organizationId: device.organization?.toString(),
                paperId,
                action: "playlist",
                updateResult: updatePlaylistResult,
              });
              if (!updatePlaylistResult?.selectedPaperId) {
                await releaseDeviceSyncClaim({ device, nextDeviceSync });
                return;
              }
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
