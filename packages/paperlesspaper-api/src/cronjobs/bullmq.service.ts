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

const queueName =
  config.env === "production"
    ? "paperlesspaperCronjobs"
    : "paperlesspaperCronjobsLocal";

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

const connection = getRedisConnection();

export const queue = new Queue(queueName, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});

const queueEvents = new QueueEvents(queueName, { connection });

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

export const enqueueNow = async (name: JobName, data?: unknown) => {
  const job = await queue.add(name, data || {});
  return toJobResult(job);
};

export const enqueueAt = async (when: Date, name: JobName, data?: unknown) => {
  const delay = Math.max(0, when.getTime() - Date.now());
  const job = await queue.add(name, data || {}, { delay });
  return toJobResult(job);
};

export const upsertEvery = async (
  interval: string,
  name: Exclude<JobName, "sendPushNotification">,
  data?: unknown,
) => {
  const every = toRepeatEveryMs(interval);
  const job = await queue.add(name, data || {}, {
    repeat: {
      every,
    },
    jobId: `${name}:${every}`,
  });

  return toJobResult(job);
};

const worker = new Worker(
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

    if (job.name === "papersCronjob") {
      const data = await cronjobPapers();
      return data;
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
    connection,
    concurrency: 20,
  },
);

queueEvents.on("failed", ({ failedReason, jobId }) => {
  const err = new Error(failedReason || "BullMQ job failed");
  console.log("error in queue", err);
  Sentry.captureException(err);
  console.log(
    `Job ${jobId || "unknown"} failed with error: ${err.message}`,
    err,
  );
});

queueEvents.on("completed", ({ jobId }) => {
  console.log(`Job ${jobId || "unknown"} finished`);
});

worker.on("error", (err) => {
  console.log("BullMQ worker error", err);
  Sentry.captureException(err);
});

console.log("\x1b[33mBullMQ started! \x1b[0m");

let started = false;

export const startBullMq = async () => {
  if (started) {
    return;
  }

  await queue.waitUntilReady();
  await worker.waitUntilReady();
  await queueEvents.waitUntilReady();
  started = true;
};
