import { config } from "@internetderdinge/api";
import { bullMqEnabled, startBullMq, upsertEvery } from "./bullmq.service";

export const startCronjobs = async () => {
  if (!bullMqEnabled) {
    console.log("BullMQ cronjobs skipped because Redis is not configured.");
    return;
  }

  await startBullMq();

  if (config.env === "development") {
    console.log("Starting cronjobs in development mode");
    // await upsertEvery("3 minutes", "papersCronjob");
  }

  if (config.env === "production") {
    console.log("Starting cronjobs in production mode");
    await upsertEvery("3 minutes", "papersCronjob");
  }
};

export default startCronjobs;
