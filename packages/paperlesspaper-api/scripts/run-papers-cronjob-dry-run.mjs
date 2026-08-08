import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });
process.env.NODE_ENV = "production";
process.env.DISABLE_BULLMQ = "true";

const [{ default: mongoose }, api, helpers, { cronjobPapers }] =
  await Promise.all([
    import("mongoose"),
    import("@internetderdinge/api"),
    import("@paperlesspaper/helpers"),
    import("../src/cronjobs/papers.cronjob.ts"),
  ]);

api.initDeviceList({ list: helpers.deviceList });

try {
  await mongoose.connect(api.config.mongoose.url, api.config.mongoose.options);

  const result = await cronjobPapers({
    id: `local-production-dry-run-${Date.now()}`,
    name: "papersCronjob",
    data: { dryRun: true },
  });

  const { meta } = result;
  console.log(
    JSON.stringify(
      {
        job: meta.job,
        dryRun: meta.dryRun,
        startedAt: meta.startedAt,
        finishedAt: meta.finishedAt,
        durationMs: meta.durationMs,
        batchSize: meta.batchSize,
        devices: meta.devices,
        actions: meta.actions,
        dueEntries: meta.updatedEntries.map((entry) => ({
          deviceId: entry.deviceId,
          paperId: entry.paperId,
          action: entry.action,
          nextDeviceSync: entry.updateResult?.nextDeviceSync,
          differenceInMinutes: entry.updateResult?.differenceInMinutes,
        })),
        errorCount: meta.errors.length,
        errors: meta.errors.slice(0, 20),
      },
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
