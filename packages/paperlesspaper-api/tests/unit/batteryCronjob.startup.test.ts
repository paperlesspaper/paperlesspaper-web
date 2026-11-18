import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  start: vi.fn(),
  schedule: vi.fn(),
  config: { env: "production" },
  enabled: true,
}));
vi.mock("@internetderdinge/api", () => ({ config: m.config }));
vi.mock("../../src/cronjobs/bullmq.service", () => ({
  startBullMq: m.start,
  upsertEvery: m.schedule,
  get bullMqEnabled() {
    return m.enabled;
  },
}));
import { startCronjobs } from "../../src/cronjobs/bullmq.start.service";
beforeEach(() => {
  vi.clearAllMocks();
  m.config.env = "production";
  m.enabled = true;
});
it("registers the four-hour battery check alongside existing schedules", async () => {
  await startCronjobs();
  expect(m.start).toHaveBeenCalledOnce();
  expect(m.schedule).toHaveBeenCalledWith("4 hours", "batteryCronjob");
  expect(m.schedule).toHaveBeenCalledWith("4 minutes", "papersCronjob");
});
it("does not enable automatic sends in development or without Redis", async () => {
  m.config.env = "development";
  await startCronjobs();
  expect(m.schedule).not.toHaveBeenCalled();
  m.config.env = "production";
  m.enabled = false;
  await startCronjobs();
  expect(m.schedule).not.toHaveBeenCalled();
});
