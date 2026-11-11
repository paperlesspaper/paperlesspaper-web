import { Queue, Worker } from "bullmq";
import { ApiError, Device, devicesService } from "@internetderdinge/api";
import { deviceKindHasFeature } from "@paperlesspaper/helpers";
import {
  bullMqEnabled,
  getRedisConnection,
} from "../cronjobs/bullmq.service.js";
import papersService from "../papers/papers.service.js";
import Paper from "../papers/papers.model.js";
import DevicesLogs from "../devicesLogs/devicesLogs.model.js";
import { normalizeTimestamp } from "../utils/normalizeTimestamp.js";
import {
  PushConnection,
  PushContent,
  PushDelivery,
  PushEvent,
  PushGrant,
  PushRequest,
} from "./models.js";
import { authorizeConnection } from "./access.js";
import { hash, sendCallback } from "./security.js";

class WorkAccessDenied extends Error {}

async function authorizeWork(connection: any, work: any) {
  // Missing generations belong to the unsafe legacy protocol and fail closed.
  if (
    !connection?.generation ||
    work.connectionGeneration !== connection.generation ||
    work.source !== connection.source
  )
    throw new WorkAccessDenied(
      "Connection changed; work is no longer authorized"
    );
  try {
    return await authorizeConnection(connection);
  } catch (error) {
    if (error instanceof ApiError && [400, 401, 403].includes(error.statusCode))
      throw new WorkAccessDenied("Connection access denied");
    throw error;
  }
}

export function confirmsVersion(
  delivery: any,
  status: any,
  latestUpload: any,
  revision: string
) {
  const fileVersion = normalizeTimestamp(status?.fileVersion);
  const reachable = normalizeTimestamp(status?.lastReachableAgo);
  const startedAt = new Date(delivery.startedAt).getTime();
  return (
    status?.pictureSynced === true &&
    fileVersion !== null &&
    reachable !== null &&
    fileVersion >= Math.floor(startedAt / 1000) * 1000 &&
    reachable >= fileVersion &&
    (delivery.previousFileVersion == null ||
      fileVersion > delivery.previousFileVersion) &&
    latestUpload?.triggerMetadata?.integrationRevision === revision &&
    new Date(latestUpload.startedAt).getTime() >= startedAt &&
    ["uploaded", "partial"].includes(latestUpload.status)
  );
}

async function event(request: any, state: string, delivery?: any) {
  const id = hash(`${request._id}:${delivery?.deviceId || "paper"}:${state}`);
  await PushEvent.updateOne(
    { _id: id },
    {
      $setOnInsert: {
        connectionId: request.connectionId,
        connectionGeneration: request.connectionGeneration,
        source: request.source,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
        payload: {
          eventId: id,
          connectionId: String(request.connectionId),
          paperId: String(request.paperId),
          requestId: request._id,
          messageId: request.messageId,
          state,
          deviceId: delivery?.deviceId ? String(delivery.deviceId) : undefined,
          frameName: delivery?.frameName,
          occurredAt: new Date().toISOString(),
        },
      },
    },
    { upsert: true }
  );
}

async function processRequest(request: any) {
  const connection = await PushConnection.findById(request.connectionId);
  let paper: any;
  try {
    paper = await authorizeWork(connection, request);
  } catch (error) {
    if (!(error instanceof WorkAccessDenied)) throw error;
    await PushRequest.updateOne(
      { _id: request._id },
      { $set: { state: "revoked" } }
    );
    return;
  }
  let current = await PushContent.findById(request.paperId);
  // A retried older request must never overwrite a more recently accepted message.
  if (
    !current ||
    new Date(current.receivedAt).getTime() <
      new Date(request.createdAt).getTime() ||
    (new Date(current.receivedAt).getTime() ===
      new Date(request.createdAt).getTime() &&
      current.revision < request._id)
  ) {
    current = await PushContent.findOneAndUpdate(
      { _id: request.paperId },
      {
        $set: {
          revision: request._id,
          source: request.source,
          text: request.text,
          imageKey: request.imageKey || null,
          receivedAt: request.createdAt,
        },
      },
      { upsert: true, new: true }
    );
  }
  const superseded = current.revision !== request._id;
  const expired =
    Date.now() - new Date(request.createdAt).getTime() > 48 * 3600_000;
  if (!superseded) {
    await event(request, "available");
    if (!expired) {
      const devices = await Device.find({
        paper: request.paperId,
        organization: paper.organization,
      });
      for (const device of devices) {
        if (!deviceKindHasFeature("epaper", device.kind)) continue;
        await PushDelivery.updateOne(
          { _id: `${request._id}-${device._id}` },
          {
            $setOnInsert: {
              requestId: request._id,
              deviceId: device._id,
              frameName: String(
                device.meta?.name || device.name || device.deviceId
              ).slice(0, 120),
              expiresAt: request.expiresAt,
            },
          },
          { upsert: true }
        );
      }
    }
  }
  const deliveries = await PushDelivery.find({ requestId: request._id });
  for (const delivery of deliveries) {
    if (["pending", "prepared"].includes(delivery.state)) {
      try {
        const device = await Device.findOne({
          _id: delivery.deviceId,
          paper: request.paperId,
          organization: paper.organization,
        });
        if (superseded) delivery.state = "superseded";
        else if (!device) delivery.state = "inactive";
        else if (expired) delivery.state = "unconfirmed";
        else if (delivery.state === "pending") {
          const before = await devicesService.populateDeviceStatus(device);
          await authorizeWork(
            await PushConnection.findById(request.connectionId),
            request
          );
          delivery.startedAt = new Date();
          delivery.previousFileVersion = normalizeTimestamp(
            before?.fileVersion
          );
          delivery.attempts += 1;
          await delivery.save();
          const result = await papersService.uploadSingleImageFromWebsite({
            paperId: paper._id,
            device,
            forceUpload: true,
            trigger: "integration-content",
          });
          const upload = result?.uploadSingleImageResult as
            | { uploadFailed?: boolean }
            | undefined;
          if (!upload || upload.uploadFailed) throw new Error("Upload failed");
          await Paper.updateOne(
            { _id: paper._id },
            { $set: { imageUpdatedAt: new Date() } }
          );
          delivery.state = "prepared";
        } else {
          const status = await devicesService.populateDeviceStatus(device);
          const latest = await DevicesLogs.findOne({
            deviceId: String(device._id),
            status: { $in: ["started", "uploaded", "partial"] },
          }).sort({ startedAt: -1 });
          if (confirmsVersion(delivery, status, latest, request._id))
            delivery.state = "synced";
        }
      } catch (error) {
        if (error instanceof WorkAccessDenied) {
          await PushRequest.updateOne(
            { _id: request._id },
            { $set: { state: "revoked" } }
          );
          return;
        }
        if (delivery.state === "pending" && delivery.attempts >= 4)
          delivery.state = "failed";
      }
      await delivery.save();
    }
    // Recreate missing outbox entries after a crash between state and event writes.
    if (delivery.state !== "pending")
      await event(request, delivery.state, delivery);
  }
  if (superseded) await event(request, "superseded");
  if (expired && !superseded && !deliveries.length)
    await event(request, "unconfirmed");
  await PushRequest.updateOne(
    { _id: request._id },
    {
      $set: {
        state: superseded ? "superseded" : expired ? "closed" : "active",
      },
    }
  );
}

export async function processPushRequests() {
  const due = await PushRequest.find({
    state: { $in: ["accepted", "active"] },
    nextCheckAt: { $lte: new Date() },
  })
    .sort({ nextCheckAt: 1, createdAt: 1, _id: 1 })
    .limit(20);
  for (const request of due) {
    await PushRequest.updateOne(
      { _id: request._id },
      { $set: { nextCheckAt: new Date(Date.now() + 60_000) } }
    );
    try {
      await processRequest(request);
    } catch {
      console.warn("Integration processing deferred", {
        requestId: request._id,
      });
    }
  }
}

export async function deliverPushEvents() {
  const due = await PushEvent.find({
    state: "pending",
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ nextAttemptAt: 1, createdAt: 1, _id: 1 })
    .limit(40);
  for (const entry of due) {
    try {
      const connection = await PushConnection.findById(
        entry.connectionId
      ).select("+callbackToken");
      await authorizeWork(connection, entry);
      await sendCallback(
        connection.callbackUrl,
        connection.callbackToken,
        entry.payload
      );
      await PushEvent.updateOne(
        { _id: entry._id },
        { $set: { state: "sent" } }
      );
    } catch (error) {
      if (error instanceof WorkAccessDenied) {
        await PushEvent.updateOne(
          { _id: entry._id },
          { $set: { state: "cancelled" } }
        );
        continue;
      }
      await PushEvent.updateOne(
        { _id: entry._id },
        {
          $inc: { attempts: 1 },
          $set: {
            nextAttemptAt: new Date(
              Date.now() +
                Math.min(3600_000, 5000 * 2 ** Math.min(entry.attempts, 10))
            ),
          },
        }
      );
    }
  }
}

async function startSweep(name: string, process: () => Promise<void>) {
  const queue = new Queue(name, { connection: getRedisConnection() });
  queue.on("error", () =>
    console.error("Integration queue unavailable", { name })
  );
  await queue.setGlobalConcurrency(1);
  const worker = new Worker(name, process, {
    connection: getRedisConnection(),
    concurrency: 1,
  });
  worker.on("error", () =>
    console.error("Integration worker unavailable", { name })
  );
  worker.on("failed", () =>
    console.error("Integration sweep deferred", { name })
  );
  await queue.upsertJobScheduler(
    "integration-push",
    { every: 30_000 },
    {
      name: "sweep",
      data: {},
      opts: { removeOnComplete: 20, removeOnFail: 20 },
    }
  );
}

let started = false;
export async function startIntegrationPushWorker() {
  if (!bullMqEnabled || started) return;
  await Promise.all(
    [
      PushConnection,
      PushGrant,
      PushRequest,
      PushContent,
      PushDelivery,
      PushEvent,
    ].map((model) => model.init())
  );
  const name =
    process.env.NODE_ENV === "production"
      ? "paperlesspaperIntegrationPush"
      : "paperlesspaperIntegrationPushLocal";
  // A slow provider callback cannot hold the image-processing queue hostage.
  await Promise.all([
    startSweep(name, processPushRequests),
    startSweep(`${name}Callbacks`, deliverPushEvents),
  ]);
  started = true;
}
