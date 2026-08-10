import type { Job } from "bullmq";

export type RepeatableJobName =
  | "batteryCronjob"
  | "papersCronjob"
  | "deviceUpdateScheduleCronjob";

export type SchedulerQueue = {
  upsertJobScheduler: (
    schedulerId: string,
    repeatOptions: { every: number },
    template: {
      name: string;
      data: unknown;
      opts: { removeOnComplete: number; removeOnFail: number };
    },
  ) => Promise<Job>;
  getJobSchedulers: (
    start?: number,
    end?: number,
    asc?: boolean,
  ) => Promise<Array<{ key: string; name: string }>>;
  removeJobScheduler: (schedulerId: string) => Promise<boolean>;
};

export const reconcileEveryOnQueue = async ({
  targetQueue,
  every,
  name,
  data,
}: {
  targetQueue: SchedulerQueue;
  every: number;
  name: RepeatableJobName;
  data?: unknown;
}) => {
  // The scheduler id deliberately does not contain the interval. Updating
  // `every` therefore updates one scheduler instead of creating another one.
  const schedulerId = `schedule:${name}`;
  const job = await targetQueue.upsertJobScheduler(
    schedulerId,
    { every },
    {
      name,
      data: data || {},
      opts: {
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    },
  );

  const schedulers = await targetQueue.getJobSchedulers(0, -1, true);
  const staleSchedulers = schedulers.filter(
    (scheduler) => scheduler.name === name && scheduler.key !== schedulerId,
  );

  await Promise.all(
    staleSchedulers.map((scheduler) =>
      targetQueue.removeJobScheduler(scheduler.key),
    ),
  );

  if (staleSchedulers.length) {
    console.log(
      `Removed ${staleSchedulers.length} stale scheduler(s) for ${name}`,
      staleSchedulers.map((scheduler) => scheduler.key),
    );
  }

  return job;
};
