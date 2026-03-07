import { config } from "@internetderdinge/api";
import { startBullMq, upsertEvery, enqueueNow } from "./bullmq.service";

export const startCronjobs = async () => {
  await startBullMq();

  if (config.env === "development") {
    console.log("Starting cronjobs in development mode");
    // await upsertEvery("3 minutes", "papersCronjob");
    // await enqueueNow("papersCronjob");
  }

  if (config.env === "production") {
    console.log("Starting cronjobs in production mode");
    await upsertEvery("3 minutes", "papersCronjob");
  }
};

export default startCronjobs;
