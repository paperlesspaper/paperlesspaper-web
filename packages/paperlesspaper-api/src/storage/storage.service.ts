import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { ApiError, Device } from "@internetderdinge/api";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import Paper from "../papers/papers.model.js";
import { StorageAccount, StorageObject } from "./storage.models.js";

export const STORAGE_LIMIT_BYTES = 500_000_000;
export const STORAGE_LIMIT_MESSAGE =
  "Organization storage limit reached (500 MB). Delete pictures or replace them with smaller images.";
const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-central-1",
  maxAttempts: 2,
  requestHandler: {
    connectionTimeout: 10_000,
    requestTimeout: 60_000,
    throwOnRequestTimeout: true,
  },
});
const bucket = () => process.env.AWS_S3_BUCKET_NAME!;
const objectId = (key: string) =>
  createHash("sha256").update(key).digest("hex");
const missing = (error: any) =>
  error?.$metadata?.httpStatusCode === 404 ||
  ["NotFound", "NoSuchKey"].includes(error?.name);

export const isStorageError = (error: any): boolean =>
  error?.message === STORAGE_LIMIT_MESSAGE || error?.storageError === true;

function storageError(status: number, message: string) {
  return Object.assign(new ApiError(status, message), { storageError: true });
}

export async function uploadOrganization(
  id?: string,
  deviceId?: string
): Promise<string> {
  const paper = id
    ? await Paper.findById(id)
        .select("organization")
        .lean<{ organization?: unknown }>()
    : null;
  if (id && !paper) throw storageError(404, "Paper not found");
  const device =
    !paper && deviceId
      ? await Device.findById(deviceId).select("organization").lean()
      : null;
  const organization = paper?.organization || device?.organization;
  if (!organization)
    throw storageError(409, "Cannot determine storage organization");
  return String(organization);
}

async function listObjects(
  prefix: string
): Promise<Array<{ key: string; bytes: number }>> {
  const objects: Array<{ key: string; bytes: number }> = [];
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const item of page.Contents || []) {
      if (item.Key) objects.push({ key: item.Key, bytes: item.Size || 0 });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !token)
      throw new Error("Incomplete storage listing");
  } while (token);
  return objects;
}

export async function storedObjectBytes(key: string): Promise<number> {
  try {
    const result = await s3.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key })
    );
    if (result.ContentLength == null)
      throw new Error("Missing storage object size");
    return result.ContentLength;
  } catch (error) {
    if (missing(error)) return 0;
    throw error;
  }
}

async function recordObject(organization: string, key: string, bytes: number) {
  try {
    await StorageObject.updateOne(
      {
        _id: objectId(key),
        $or: [
          { organization },
          { bytes: 0 },
          { organization: { $exists: false } },
        ],
      },
      { $set: { organization, key, bytes } },
      { upsert: true }
    );
  } catch (error: any) {
    if (error?.code === 11000)
      throw storageError(409, "Stored image belongs to another organization");
    throw error;
  }
}

async function updateTotal(organization: string) {
  const totals = await StorageObject.aggregate([
    { $match: { organization } },
    { $group: { _id: null, bytes: { $sum: "$bytes" } } },
  ]);
  const usedBytes = totals[0]?.bytes || 0;
  await StorageAccount.updateOne(
    { _id: organization },
    { $set: { usedBytes } }
  );
  return usedBytes;
}

async function initialize(organization: string) {
  const account = await StorageAccount.findById(organization).lean();
  if (account?.initialized) return;
  const [papers, devices] = await Promise.all([
    Paper.find({ organization }).select("_id").lean(),
    Device.find({ organization }).select("_id deviceId").lean(),
  ]);
  // Prefix listings include all variants, legacy device uploads and snapshots.
  const prefixes = papers.flatMap((paper: any) => [
    `ePaperImages/${paper._id}`,
    `integration-push/${paper._id}/`,
  ]);
  for (const device of devices as any[]) {
    prefixes.push(`ePaperImages/${device._id}`);
    if (device.deviceId)
      prefixes.push(
        `ePaperDeviceImages/${encodeURIComponent(device.deviceId)}.png`
      );
  }
  for (const prefix of prefixes) {
    for (const object of await listObjects(prefix))
      await recordObject(organization, object.key, object.bytes);
  }
  await updateTotal(organization);
  await StorageAccount.updateOne(
    { _id: organization },
    { $set: { initialized: true } }
  );
}

/** Durable, non-expiring mutex: a crashed writer cannot outlive its reservation.
 * Recovery must reconcile S3 after stopping writers (see storage-budget.md).
 * Never expire this lock while a timed-out storage request could still finish.
 */
async function withStorageLock<T>(
  organization: string,
  run: (lock: { keepLocked: boolean }) => Promise<T>
): Promise<T> {
  try {
    await StorageAccount.updateOne(
      { _id: organization },
      { $setOnInsert: { usedBytes: 0, initialized: false } },
      { upsert: true }
    );
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }
  const token = randomUUID();
  const deadline = Date.now() + 15_000;
  let acquired = false;
  do {
    const result = await StorageAccount.updateOne(
      { _id: organization, lockToken: { $exists: false } },
      { $set: { lockToken: token, lockedAt: new Date() } }
    );
    acquired = result.modifiedCount === 1;
    if (!acquired) await delay(100);
  } while (!acquired && Date.now() < deadline);
  if (!acquired)
    throw storageError(409, "Storage is busy. Please retry shortly.");
  const lock = { keepLocked: false };
  try {
    await initialize(organization);
    return await run(lock);
  } finally {
    if (lock.keepLocked) {
      console.error("Organization storage requires reconciliation", {
        organization,
        lockToken: token,
      });
    }
    if (!lock.keepLocked)
      await StorageAccount.updateOne(
        { _id: organization, lockToken: token },
        { $unset: { lockToken: 1, lockedAt: 1 } }
      );
  }
}

export type StorageWrite = {
  key: string;
  bytes: number;
  write: () => Promise<unknown>;
};

/** Reserve each object before writing it. On uncertain I/O the high-water
 * reservation and lock remain until offline reconciliation.
 */
export async function writeStoredObjects(
  organization: string,
  input: StorageWrite[] | (() => Promise<StorageWrite[]>),
  validate?: () => Promise<void>
) {
  return withStorageLock(organization, async (lock) => {
    await validate?.();
    const writes = typeof input === "function" ? await input() : input;
    if (writes.some(({ bytes }) => !Number.isSafeInteger(bytes) || bytes < 0))
      throw new Error("Invalid stored object size");
    const unique = new Set(writes.map((write) => write.key));
    if (unique.size !== writes.length) throw new Error("Duplicate storage key");
    const oldSizes = await Promise.all(
      writes.map(({ key }) => storedObjectBytes(key))
    );
    for (let i = 0; i < writes.length; i++)
      await recordObject(organization, writes[i].key, oldSizes[i]);
    const usedBytes = await updateTotal(organization);
    const delta = writes.reduce(
      (sum, write, i) => sum + write.bytes - oldSizes[i],
      0
    );
    if (delta > 0 && usedBytes + delta > STORAGE_LIMIT_BYTES)
      throw storageError(413, STORAGE_LIMIT_MESSAGE);
    // Shrink first so even a partially completed replacement stays within the
    // budget. The durable organization lock protects the entire batch.
    const ordered = writes
      .map((write, i) => ({ ...write, oldBytes: oldSizes[i] }))
      .sort((a, b) => a.bytes - a.oldBytes - (b.bytes - b.oldBytes));
    lock.keepLocked = true;
    for (const write of ordered) {
      await recordObject(
        organization,
        write.key,
        Math.max(write.oldBytes, write.bytes)
      );
      await updateTotal(organization);
      await write.write();
      await recordObject(organization, write.key, write.bytes);
      await updateTotal(organization);
    }
    lock.keepLocked = false;
  });
}

export async function getStorageUsage(organization: string) {
  let account = await StorageAccount.findById(organization).lean();
  if (!account?.initialized) {
    await withStorageLock(organization, async () => {});
    account = await StorageAccount.findById(organization).lean();
  }
  const usedBytes = account?.usedBytes || 0;
  return {
    usedBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    remainingBytes: Math.max(0, STORAGE_LIMIT_BYTES - usedBytes),
  };
}

export async function deleteStoredObject(
  key: string,
  remove: () => Promise<unknown>
) {
  const object = await StorageObject.findById(objectId(key)).lean();
  if (!object) return remove();
  return withStorageLock(object.organization, async (lock) => {
    lock.keepLocked = true;
    await remove();
    await recordObject(object.organization, key, 0);
    await updateTotal(object.organization);
    lock.keepLocked = false;
  });
}

/** Offline maintenance only: callers must stop ALL writers before invoking. */
export async function reconcileStorageOffline(organization: string) {
  // Also discover existing assets that predate accounting. Keep the lock until
  // every HEAD and database update has succeeded.
  await StorageAccount.updateOne(
    { _id: organization },
    {
      $set: {
        initialized: false,
        lockToken: randomUUID(),
        lockedAt: new Date(),
      },
    },
    { upsert: true }
  );
  await initialize(organization);
  for (const object of await StorageObject.find({ organization }).lean()) {
    await recordObject(
      organization,
      object.key,
      await storedObjectBytes(object.key)
    );
  }
  await updateTotal(organization);
  await StorageAccount.updateOne(
    { _id: organization },
    { $unset: { lockToken: 1, lockedAt: 1 } }
  );
  return getStorageUsage(organization);
}

export async function deletePaperStorage(
  paperId: string,
  organization: string,
  deletePaper: () => Promise<unknown>
) {
  return withStorageLock(organization, async (lock) => {
    const prefixes = [
      `ePaperImages/${paperId}`,
      `integration-push/${paperId}/`,
    ];
    const keys = new Set<string>();
    for (const prefix of prefixes)
      for (const object of await listObjects(prefix)) keys.add(object.key);
    // Include reserved/failed objects as well as actual objects.
    const recorded = await StorageObject.find({ organization }).lean();
    for (const object of recorded)
      if (prefixes.some((prefix) => object.key.startsWith(prefix)))
        keys.add(object.key);
    lock.keepLocked = true;
    const results = await Promise.allSettled(
      [...keys].map(async (key) => {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
        await recordObject(organization, key, 0);
      })
    );
    await updateTotal(organization);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    await deletePaper();
    lock.keepLocked = false;
  });
}
