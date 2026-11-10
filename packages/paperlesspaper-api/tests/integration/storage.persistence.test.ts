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

const objects = vi.hoisted(() => new Map<string, number>());
const failures = vi.hoisted(() => ({ head: false, deletion: false }));
vi.mock("@internetderdinge/api", async () => {
  const { default: mongoose } = await import("mongoose");
  return {
    ApiError: class extends Error {
      constructor(public statusCode: number, message: string) {
        super(message);
      }
    },
    Device: mongoose.model(
      "StorageTestDevice",
      new mongoose.Schema({
        organization: mongoose.Schema.Types.ObjectId,
        deviceId: String,
      })
    ),
    paginate: () => {},
    toJSON: () => {},
  };
});
vi.mock("@aws-sdk/client-s3", async (original) => {
  const actual = await original<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      async send(command: any) {
        const { Key, Prefix, ContinuationToken } = command.input;
        if (command instanceof actual.HeadObjectCommand) {
          if (failures.head) throw new Error("S3 unavailable");
          if (!objects.has(Key))
            throw Object.assign(new Error("missing"), { name: "NotFound" });
          return { ContentLength: objects.get(Key) };
        }
        if (command instanceof actual.DeleteObjectCommand) {
          if (failures.deletion) throw new Error("Deletion failed");
          objects.delete(Key);
          return {};
        }
        const matches = [...objects].filter(([key]) => key.startsWith(Prefix));
        const start = Number(ContinuationToken || 0);
        // Exercise paginated baseline and deletion discovery.
        return {
          Contents: matches
            .slice(start, start + 2)
            .map(([Key, Size]) => ({ Key, Size })),
          IsTruncated: start + 2 < matches.length,
          NextContinuationToken: String(start + 2),
        };
      }
    },
  };
});

import Paper from "../../src/papers/papers.model.js";
import { Device } from "@internetderdinge/api";
import {
  StorageAccount,
  StorageObject,
} from "../../src/storage/storage.models.js";
import {
  deletePaperStorage,
  deleteStoredObject,
  getStorageUsage,
  reconcileStorageOffline,
  STORAGE_LIMIT_BYTES as LIMIT,
  uploadOrganization,
  writeStoredObjects,
} from "../../src/storage/storage.service.js";

const url = process.env.STORAGE_TEST_MONGODB_URL;
describe.skipIf(!url)("organization storage budget (real MongoDB)", () => {
  const org = "682fd0d7d4a6325d9d45b86e";
  const other = "682fd0d7d4a6325d9d45b86f";
  const paperId = "682fd0d7d4a6325d9d45b870";
  const prefix = `ePaperImages/${paperId}`;
  const write = (key: string, bytes: number) => ({
    key,
    bytes,
    write: vi.fn(async () => {
      objects.set(key, bytes);
    }),
  });

  beforeAll(async () => {
    if (!new URL(url!).pathname.startsWith("/paperless-storage-test-"))
      throw new Error("Use a disposable paperless-storage-test-* database");
    await mongoose.connect(url!);
    await Promise.all([StorageAccount.init(), StorageObject.init()]);
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    objects.clear();
    failures.head = false;
    failures.deletion = false;
    await Promise.all([
      StorageAccount.deleteMany({}),
      StorageObject.deleteMany({}),
      Paper.deleteMany({}),
      Device.deleteMany({}),
    ]);
    await Paper.create({ _id: paperId, organization: org });
  });

  it("counts every legacy variant, editor data, integrations and device snapshots once", async () => {
    for (const suffix of [
      ".png",
      "original.jpg",
      "original.png",
      "thumbnail.jpg",
      "editable.json",
    ])
      objects.set(prefix + suffix, 100);
    objects.set(`integration-push/${paperId}/message.png`, 200);
    const device = await Device.create({
      organization: org,
      deviceId: "epd7-test",
    });
    objects.set(`ePaperImages/${device._id}+current-frame.png`, 300);
    objects.set("ePaperDeviceImages/epd7-test.png", 400);
    objects.set("ePaperImages/foreign.png", 9999);
    expect(await getStorageUsage(org)).toEqual({
      usedBytes: 1400,
      limitBytes: LIMIT,
      remainingBytes: LIMIT - 1400,
    });
    expect((await getStorageUsage(org)).usedBytes).toBe(1400);
    expect((await getStorageUsage(other)).usedBytes).toBe(0);
  });

  it("accepts exactly 500 MB and rejects one additional byte before S3 is called", async () => {
    await writeStoredObjects(org, [write(prefix + ".png", LIMIT)]);
    const extra = write(prefix + "original.jpg", 1);
    await expect(writeStoredObjects(org, [extra])).rejects.toMatchObject({
      statusCode: 413,
    });
    expect(extra.write).not.toHaveBeenCalled();
    expect((await getStorageUsage(org)).usedBytes).toBe(LIMIT);
    expect((await StorageAccount.findById(org))?.lockToken).toBeUndefined();
  });

  it("charges only the replacement delta, shrinking variants before growing others", async () => {
    objects.set(prefix + ".png", 300_000_000);
    objects.set(prefix + "original.jpg", 200_000_000);
    const smaller = write(prefix + "original.jpg", 100_000_000);
    const larger = write(prefix + ".png", 350_000_000);
    larger.write.mockImplementation(async () => {
      expect(objects.get(smaller.key)).toBe(smaller.bytes);
      objects.set(larger.key, larger.bytes);
    });
    await writeStoredObjects(org, [larger, smaller]);
    expect((await getStorageUsage(org)).usedBytes).toBe(450_000_000);
  });

  it("preserves and counts editor JSON when an update does not replace it", async () => {
    objects.set(prefix + "editable.json", 10);
    await writeStoredObjects(org, [write(prefix + ".png", 100)]);
    await writeStoredObjects(org, [write(prefix + ".png", 200)]);
    expect((await getStorageUsage(org)).usedBytes).toBe(210);
  });

  it("allows shrinking legacy organizations over budget while refusing growth", async () => {
    objects.set(prefix + ".png", LIMIT + 100);
    await writeStoredObjects(org, [write(prefix + ".png", LIMIT + 50)]);
    await expect(
      writeStoredObjects(org, [write(prefix + ".png", LIMIT + 51)])
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it("serializes simultaneous uploads even during first-time accounting", async () => {
    const results = await Promise.allSettled([
      writeStoredObjects(org, [write(prefix + ".png", 300_000_000)]),
      writeStoredObjects(org, [write(prefix + "original.jpg", 300_000_000)]),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect((await getStorageUsage(org)).usedBytes).toBe(300_000_000);
  });

  it("keeps failed writes reserved and locked until offline reconciliation", async () => {
    const failed = {
      key: prefix + ".png",
      bytes: 200,
      write: async () => {
        throw new Error("timeout");
      },
    };
    await expect(writeStoredObjects(org, [failed])).rejects.toThrow("timeout");
    expect((await getStorageUsage(org)).usedBytes).toBe(200);
    expect((await StorageAccount.findById(org))?.lockToken).toBeTruthy();
    // A late S3 completion is accounted for before reopening writes.
    objects.set(failed.key, 200);
    expect((await reconcileStorageOffline(org)).usedBytes).toBe(200);
    expect((await StorageAccount.findById(org))?.lockToken).toBeUndefined();
  });

  it("does not turn S3 errors into zero usage or allow unmeasured uploads", async () => {
    await getStorageUsage(org);
    failures.head = true;
    const next = write(prefix + ".png", 20);
    await expect(writeStoredObjects(org, [next])).rejects.toThrow(
      "S3 unavailable"
    );
    expect(next.write).not.toHaveBeenCalled();
  });

  it("deletes every variant and integration file before deleting the paper, freeing capacity", async () => {
    objects.set(prefix + ".png", LIMIT - 10);
    objects.set(`integration-push/${paperId}/message.png`, 10);
    await getStorageUsage(org);
    await deletePaperStorage(paperId, org, async () => {
      expect(objects.size).toBe(0);
      await Paper.deleteOne({ _id: paperId });
    });
    expect((await getStorageUsage(org)).usedBytes).toBe(0);
    expect(await Paper.findById(paperId)).toBeNull();
  });

  it("keeps the paper and charged bytes when storage deletion fails", async () => {
    objects.set(prefix + ".png", 100);
    failures.deletion = true;
    const remove = vi.fn();
    await expect(deletePaperStorage(paperId, org, remove)).rejects.toThrow(
      "Deletion failed"
    );
    expect(remove).not.toHaveBeenCalled();
    expect((await getStorageUsage(org)).usedBytes).toBe(100);
  });

  it("revalidates paper existence after acquiring the lock", async () => {
    const next = write(prefix + ".png", 100);
    await Paper.deleteOne({ _id: paperId });
    await expect(
      writeStoredObjects(org, [next], async () => {
        await uploadOrganization(paperId);
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(next.write).not.toHaveBeenCalled();
  });

  it("rejects another organization's accounted object", async () => {
    await writeStoredObjects(org, [write(prefix + ".png", 100)]);
    const overwrite = write(prefix + ".png", 50);
    await expect(writeStoredObjects(other, [overwrite])).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(overwrite.write).not.toHaveBeenCalled();
  });

  it("releases the old owner's device cache on reset", async () => {
    const key = "ePaperDeviceImages/reset.png";
    await writeStoredObjects(org, [write(key, 100)]);
    await deleteStoredObject(key, async () => {
      objects.delete(key);
    });
    expect((await getStorageUsage(org)).usedBytes).toBe(0);
    await writeStoredObjects(other, [write(key, 50)]);
    expect((await getStorageUsage(other)).usedBytes).toBe(50);
  });
});
