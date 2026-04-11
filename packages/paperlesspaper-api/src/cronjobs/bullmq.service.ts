import type { RedisOptions } from "ioredis";
import { Queue, Worker, QueueEvents, type Job } from "bullmq";
import { accountsService, config } from "@internetderdinge/api";
import * as Sentry from "@sentry/node";
import { sendPushNotification } from "./notifications.push";
import {
  cronjobBattery,
  messageTitleBattery,
  messageBodyBattery,
  messageTitleOffline,
  messageBodyOffline,
} from "./battery.cronjob";
import { addMessages } from "./addMessages.service";
import { cronjobPapers } from "./papers.cronjob";

type JobName = "batteryCronjob" | "papersCronjob" | "sendPushNotification";

const hasRedisConfig = () =>
  !!(process.env.REDIS_URL?.trim() || process.env.REDIS_HOST?.trim());

export const bullMqEnabled =
  process.env.DISABLE_BULLMQ !== "true" && hasRedisConfig();

const queueName =
  config.env === "production"
    ? "paperlesspaperCronjobs"
    : "paperlesspaperCronjobsLocal";

const papersQueueName =
  config.env === "production"
    ? "paperlesspaperPapersCronjobs"
    : "paperlesspaperPapersCronjobsLocal";

const getRedisConnection = (): RedisOptions => {
  const redisUrl = process.env.REDIS_URL;
  const isFlyPrivateRedisUrl =
    !!redisUrl && redisUrl.includes("fly-") && redisUrl.includes("upstash.io");

  if (config.env === "development" && isFlyPrivateRedisUrl) {
    const parsed = new URL(redisUrl);
    console.warn(
      "Detected Fly private REDIS_URL in development; falling back to REDIS_HOST/REDIS_PORT (default 127.0.0.1:6379)",
    );
    return {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || parsed.password || undefined,
      db: Number(process.env.REDIS_DB || 0),
      maxRetriesPerRequest: null,
    };
  }

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: parsed.pathname ? Number(parsed.pathname.replace("/", "") || 0) : 0,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    maxRetriesPerRequest: null,
  };
};

const connection = bullMqEnabled ? getRedisConnection() : null;

if (!bullMqEnabled) {
  console.warn(
    "BullMQ disabled: REDIS_URL/REDIS_HOST is missing or DISABLE_BULLMQ=true.",
  );
}

export const queue = bullMqEnabled
  ? new Queue(queueName, {
      connection: connection!,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    })
  : null;

export const papersQueue = bullMqEnabled
  ? new Queue(papersQueueName, {
      connection: connection!,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    })
  : null;

const queueEvents = bullMqEnabled
  ? new QueueEvents(queueName, { connection: connection! })
  : null;
const papersQueueEvents = bullMqEnabled
  ? new QueueEvents(papersQueueName, { connection: connection! })
  : null;

const toRepeatEveryMs = (value: string): number => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)\s*(minute|minutes|hour|hours)$/i);

  if (!match) {
    throw new Error(`Unsupported repeat interval: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith("hour")) {
    return amount * 60 * 60 * 1000;
  }

  return amount * 60 * 1000;
};

const toJobResult = (job: Job) => ({
  id: job.id,
  name: job.name,
  data: job.data,
});

const getQueueForJob = (name: JobName) => {
  if (!bullMqEnabled || !queue || !papersQueue) {
    throw new Error(
      "BullMQ is disabled. Configure REDIS_URL or REDIS_HOST/REDIS_PORT, or keep DISABLE_BULLMQ=true.",
    );
  }

  return name === "papersCronjob" ? papersQueue : queue;
};

export const enqueueNow = async (name: JobName, data?: unknown) => {
  const job = await getQueueForJob(name).add(name, data || {});
  return toJobResult(job);
};

export const enqueueAt = async (when: Date, name: JobName, data?: unknown) => {
  const delay = Math.max(0, when.getTime() - Date.now());
  const job = await getQueueForJob(name).add(name, data || {}, { delay });
  return toJobResult(job);
};

export const upsertEvery = async (
  interval: string,
  name: Exclude<JobName, "sendPushNotification">,
  data?: unknown,
) => {
  const every = toRepeatEveryMs(interval);
  const job = await getQueueForJob(name).add(name, data || {}, {
    repeat: {
      every,
    },
    jobId: `${name}:${every}`,
  });

  return toJobResult(job);
};

const worker = bullMqEnabled
  ? new Worker(
      queueName,
      async (job) => {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        if (job.name === "batteryCronjob") {
          /* 
          const data = await cronjobBattery(job.data);
          await addMessages(data, { enqueueNow, enqueueAt });
          return data;*/
          return null;
        }

        if (job.name === "sendPushNotification") {
          const data = job.data;

          const auth0accountPreload = data?.deviceNotifications?.user
            ? await accountsService.getAccountById(data.deviceNotifications.user)
            : undefined;

          const lng = auth0accountPreload?.data.app_metadata?.language || "de";
          data.lng = lng;

          if (data.kind === "offline") {
            data.title = await messageTitleOffline(data, lng);
            data.body = await messageBodyOffline(data, lng);
            await sendPushNotification(data);
          } else if (data.kind === "battery") {
            data.title = await messageTitleBattery(data, lng);
            data.body = await messageBodyBattery(data, lng);
            await sendPushNotification(data);
          }

          console.log("send push completed");
          return { status: "unread" };
        }

        throw new Error(`Unknown job: ${job.name}`);
      },
      {
        connection: connection!,
        concurrency: 20,
      },
    )
  : null;

const papersWorker = bullMqEnabled
  ? new Worker(
      papersQueueName,
      async (job) => {
        console.log(`Processing papers job ${job.id} of type ${job.name}`);

        if (job.name === "papersCronjob") {
          const data = await cronjobPapers();
          return data;
        }

        throw new Error(`Unknown papers job: ${job.name}`);
      },
      {
        connection: connection!,
        concurrency: 5,
      },
    )
  : null;

queueEvents?.on("failed", ({ failedReason, jobId }) => {
  const err = new Error(failedReason || "BullMQ job failed");
  console.log("error in queue", err);
  Sentry.captureException(err);
  console.log(
    `Job ${jobId || "unknown"} failed with error: ${err.message}`,
    err,
  );
});

queueEvents?.on("completed", ({ jobId }) => {
  console.log(`Job ${jobId || "unknown"} finished`);
});

papersQueueEvents?.on("failed", ({ failedReason, jobId }) => {
  const err = new Error(failedReason || "BullMQ papers job failed");
  console.log("error in papers queue", err);
  Sentry.captureException(err);
  console.log(
    `Papers job ${jobId || "unknown"} failed with error: ${err.message}`,
    err,
  );
});

papersQueueEvents?.on("completed", ({ jobId }) => {
  console.log(`Papers job ${jobId || "unknown"} finished`);
});

worker?.on("error", (err) => {
  console.log("BullMQ worker error", err);
  Sentry.captureException(err);
});

papersWorker?.on("error", (err) => {
  console.log("BullMQ papers worker error", err);
  Sentry.captureException(err);
});

if (bullMqEnabled) {
  console.log("\x1b[33mBullMQ started! \x1b[0m");
}

let started = false;

export const startBullMq = async () => {
  if (started) {
    return;
  }

  if (
    !bullMqEnabled ||
    !queue ||
    !worker ||
    !queueEvents ||
    !papersQueue ||
    !papersWorker ||
    !papersQueueEvents
  ) {
    return;
  }

  await queue.waitUntilReady();
  await worker.waitUntilReady();
  await queueEvents.waitUntilReady();
  await papersQueue.waitUntilReady();
  await papersWorker.waitUntilReady();
  await papersQueueEvents.waitUntilReady();
  started = true;
};
