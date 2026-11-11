import { randomUUID } from "node:crypto";
import { Queue, Worker } from "bullmq";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconcileEveryOnQueue } from "../../src/cronjobs/bullmq.schedulers";

const redisUrl = process.env.CRONJOB_TEST_REDIS_URL;
describe.skipIf(!redisUrl)(
  "recurring jobs survive deployment (real Redis)",
  () => {
    let queue: Queue;
    const workers: Worker[] = [];
    const connection = redisUrl
      ? { url: redisUrl, maxRetriesPerRequest: null }
      : {};
    beforeEach(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(redisUrl!).hostname))
        throw new Error("Use isolated local test Redis");
      queue = new Queue(`pr181-test-${randomUUID()}`, { connection });
      await queue.waitUntilReady();
    });
    afterEach(async () => {
      await Promise.all(workers.splice(0).map((worker) => worker.close()));
      await queue.obliterate({ force: true });
      await queue.close();
    });
    it("reconciles repeated startup without duplicating schedules or removing other jobs", async () => {
      await queue.upsertJobScheduler(
        "old-interval",
        { every: 180_000 },
        { name: "papersCronjob" }
      );
      await queue.upsertJobScheduler(
        "other-job",
        { every: 600_000 },
        { name: "deviceUpdateScheduleCronjob" }
      );
      for (let i = 0; i < 3; i++)
        await reconcileEveryOnQueue({
          targetQueue: queue,
          name: "papersCronjob",
          every: 240_000,
        });
      const schedules = await queue.getJobSchedulers();
      expect(schedules.filter((s) => s.name === "papersCronjob")).toMatchObject(
        [{ key: "schedule:papersCronjob", every: 240_000 }]
      );
      expect(schedules.find((s) => s.key === "other-job")).toBeDefined();
    });
    it("continues scheduled processing after replacing the worker and respects global concurrency", async () => {
      await queue.setGlobalConcurrency(1);
      await reconcileEveryOnQueue({
        targetQueue: queue,
        name: "papersCronjob",
        every: 100,
      });
      let active = 0;
      let peak = 0;
      let completed = 0;
      const start = () => {
        const worker = new Worker(
          queue.name,
          async () => {
            peak = Math.max(peak, ++active);
            await new Promise((resolve) => setTimeout(resolve, 30));
            active--;
          },
          { connection, concurrency: 1 }
        );
        worker.on("completed", () => {
          completed++;
        });
        workers.push(worker);
        return worker;
      };
      const original = start();
      await expect.poll(() => completed).toBeGreaterThanOrEqual(2);
      start(); // start-first rolling deployment: both replicas overlap briefly
      await original.close();
      const before = completed;
      await reconcileEveryOnQueue({
        targetQueue: queue,
        name: "papersCronjob",
        every: 100,
      });
      await expect.poll(() => completed).toBeGreaterThanOrEqual(before + 2);
      expect(peak).toBe(1);
      expect(await queue.getJobSchedulersCount()).toBe(1);
    });
  }
);
