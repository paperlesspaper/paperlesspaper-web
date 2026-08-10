import { describe, expect, it, vi } from "vitest";

import { reconcileEveryOnQueue } from "../../src/cronjobs/bullmq.schedulers";

describe("BullMQ scheduler reconciliation", () => {
  it("uses a stable scheduler id and removes stale schedules for the job", async () => {
    const nextJob = {
      id: "repeat:schedule:papersCronjob:next",
      name: "papersCronjob",
      data: {},
    };
    const targetQueue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(nextJob),
      getJobSchedulers: vi.fn().mockResolvedValue([
        { key: "schedule:papersCronjob", name: "papersCronjob" },
        { key: "legacy-3-minute-hash", name: "papersCronjob" },
        { key: "other-schedule", name: "deviceUpdateScheduleCronjob" },
      ]),
      removeJobScheduler: vi.fn().mockResolvedValue(true),
    };

    const result = await reconcileEveryOnQueue({
      targetQueue: targetQueue as any,
      every: 300_000,
      name: "papersCronjob",
    });

    expect(targetQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "schedule:papersCronjob",
      { every: 300_000 },
      expect.objectContaining({
        name: "papersCronjob",
        data: {},
      }),
    );
    expect(targetQueue.removeJobScheduler).toHaveBeenCalledTimes(1);
    expect(targetQueue.removeJobScheduler).toHaveBeenCalledWith(
      "legacy-3-minute-hash",
    );
    expect(result).toBe(nextJob);
  });
});
