import { mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { endpoint, run } from "./runner.mjs";
import { acquireLock } from "./lock.mjs";

const number = (name, fallback, min, max) => {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`Invalid ${name}`);
  return n;
};
const secret = (name) => {
  const value = process.env[name];
  if (!value || value.length < 32)
    throw new Error(`${name} must contain at least 32 characters`);
  return value;
};

async function main() {
  const command = process.argv[2] || "check";
  if (!["check", "service"].includes(command))
    throw new Error("Use check or service");
  const publish = command === "service" || process.argv.includes("--publish");
  const allowHttp = process.env.ALLOW_HTTP_LOCAL === "true";
  const config = {
    snapshotUrl: endpoint(
      process.env.SLIDESHOW_SNAPSHOT_URL,
      "SLIDESHOW_SNAPSHOT_URL",
      allowHttp
    ),
    apiToken: secret("SLIDESHOW_MONITOR_TOKEN"),
    adminUrl: publish
      ? endpoint(
          process.env.ADMIN_MONITOR_INGEST_URL,
          "ADMIN_MONITOR_INGEST_URL",
          allowHttp
        )
      : null,
    adminToken: publish ? secret("ADMIN_MONITOR_INGEST_TOKEN") : null,
    alertUrl: process.env.ALERT_WEBHOOK_URL
      ? endpoint(process.env.ALERT_WEBHOOK_URL, "ALERT_WEBHOOK_URL", allowHttp)
      : null,
    alertToken: process.env.ALERT_WEBHOOK_TOKEN,
    heartbeatUrl: process.env.MONITOR_HEARTBEAT_URL
      ? endpoint(
          process.env.MONITOR_HEARTBEAT_URL,
          "MONITOR_HEARTBEAT_URL",
          allowHttp
        )
      : null,
    stateFile: process.env.STATE_FILE || "/data/slideshows.json",
    environment: process.env.MONITOR_ENVIRONMENT || "development",
    intervalMs: number("CHECK_INTERVAL_SECONDS", 120, 30, 3600) * 1000,
    graceMs: number("GRACE_SECONDS", 300, 60, 3600) * 1000,
    reminderMs: number("FAILURE_REMINDER_HOURS", 6, 1, 168) * 3600_000,
    maxPages: number("MAX_PAGES", 500, 1, 5000),
    scanTimeoutMs: number("SCAN_TIMEOUT_SECONDS", 300, 30, 1800) * 1000,
  };
  if (command === "check" && !publish) {
    const result = await run(config);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode =
      result.status === "passed" || result.status === "watching" ? 0 : 1;
    return;
  }
  await mkdir(path.dirname(config.stateFile), { recursive: true });
  const release = await acquireLock(config.stateFile);
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    do {
      const started = Date.now();
      try {
        const result = await run(config, { publish: true });
        console.log(
          JSON.stringify({
            monitor: result.monitorName,
            status: result.status,
            counts: result.summary.counts,
          })
        );
        if (command === "check")
          process.exitCode = ["passed", "watching"].includes(result.status)
            ? 0
            : 1;
      } catch {
        console.error(
          "Monitor run or report delivery failed; inspect configuration and destination availability."
        );
        if (command === "check") process.exitCode = 1;
      }
      if (command === "check") break;
      const until = started + config.intervalMs;
      while (!stopping && Date.now() < until)
        await sleep(Math.min(1000, until - Date.now()));
    } while (!stopping);
  } finally {
    await release();
  }
}
main().catch(() => {
  console.error(
    "Monitor startup failed. Check required URLs, secrets and state volume."
  );
  process.exitCode = 1;
});
