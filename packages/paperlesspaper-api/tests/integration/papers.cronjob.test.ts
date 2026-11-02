import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queryDevicesByUserMock,
  populateDeviceStatusMock,
  findOneAndUpdateMock,
  updateOneMock,
  getByIdsMock,
  updateNextSlideMock,
  updatePlaylistMock,
  uploadSingleImageFromWebsiteMock,
} = vi.hoisted(() => ({
  queryDevicesByUserMock: vi.fn(),
  populateDeviceStatusMock: vi.fn(),
  findOneAndUpdateMock: vi.fn(),
  updateOneMock: vi.fn(),
  getByIdsMock: vi.fn(),
  updateNextSlideMock: vi.fn(),
  updatePlaylistMock: vi.fn(),
  uploadSingleImageFromWebsiteMock: vi.fn(),
}));

vi.mock("@internetderdinge/api", () => ({
  Device: {
    findOneAndUpdate: findOneAndUpdateMock,
    updateOne: updateOneMock,
  },
  devicesService: {
    queryDevicesByUser: queryDevicesByUserMock,
    populateDeviceStatus: populateDeviceStatusMock,
  },
}));

vi.mock("../../src/papers/papers.service.ts", () => ({
  default: {
    getByIds: getByIdsMock,
    updateNextSlide: updateNextSlideMock,
    updatePlaylist: updatePlaylistMock,
    uploadSingleImageFromWebsite: uploadSingleImageFromWebsiteMock,
  },
}));

import { cronjobPapers } from "../../src/cronjobs/papers.cronjob";

const buildDevice = () => ({
  _id: "device-db-id",
  id: "device-db-id",
  deviceId: "epd13-test",
  kind: "openpaper13",
  paper: "paper-id",
  organization: "organization-id",
  meta: {},
  markModified: vi.fn(),
});

const buildPaper = () => ({
  _id: "paper-id",
  kind: "slides",
  organization: "organization-id",
  meta: {
    selectedPapers: { "image-id": true },
    currentSlide: 0,
  },
});

describe("papers cronjob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T10:00:00.000Z"));
    vi.clearAllMocks();

    queryDevicesByUserMock.mockResolvedValue({ results: [buildDevice()] });
    getByIdsMock.mockResolvedValue([buildPaper()]);
    populateDeviceStatusMock.mockResolvedValue({
      nextDeviceSync: "2026-08-07T10:05:00.000Z",
    });
    findOneAndUpdateMock.mockResolvedValue({ _id: "device-db-id" });
    updateOneMock.mockResolvedValue({ acknowledged: true, matchedCount: 1 });
    updateNextSlideMock.mockResolvedValue({ selectedPaperId: "image-id" });
  });

  it.each([
    [undefined, 5],
    ["bad", 5],
    [0, 5],
    [300, 5],
    [7200, 5],
    [7201, 10],
    [28800, 10],
    [28801, 15],
    [86399, 15],
    [86400, 25],
  ])(
    "uses the slideshow lead time for interval %s",
    async (interval, minutes) => {
      const device = buildDevice();
      device.meta = { sleepTime: interval };
      queryDevicesByUserMock.mockResolvedValue({ results: [device] });
      populateDeviceStatusMock.mockResolvedValue({
        nextDeviceSync: new Date(
          Date.now() + Number(minutes) * 60_000,
        ).toISOString(),
      });
      expect((await cronjobPapers({ id: "boundary" })).meta.errors).toEqual([]);
      expect(updateNextSlideMock).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [7200, 5],
    [28800, 10],
    [43200, 15],
    [86400, 25],
  ])(
    "remembers but does not render interval %s before its lead window",
    async (interval, minutes) => {
      const device = buildDevice();
      device.meta = { sleepTime: interval };
      queryDevicesByUserMock.mockResolvedValue({ results: [device] });
      populateDeviceStatusMock.mockResolvedValue({
        nextDeviceSync: new Date(
          Date.now() + minutes * 60_000 + 1,
        ).toISOString(),
      });
      const result = await cronjobPapers({ id: "too-early" });
      expect(result.meta.errors).toEqual([]);
      expect(result.meta.devices.outsideSyncWindow).toBe(1);
      expect(updateNextSlideMock).not.toHaveBeenCalled();
      expect(updateOneMock).toHaveBeenCalledWith(expect.any(Object), {
        $set: {
          "meta.paperCronjobSync": expect.objectContaining({
            status: "pending",
          }),
        },
      });
    },
  );

  it.each(["playlist", "weather"])(
    "keeps the five-minute window for %s",
    async (kind) => {
      const device = buildDevice();
      device.meta = { sleepTime: 86400 };
      queryDevicesByUserMock.mockResolvedValue({ results: [device] });
      getByIdsMock.mockResolvedValue([{ ...buildPaper(), kind }]);
      populateDeviceStatusMock.mockResolvedValue({
        nextDeviceSync: "2026-08-07T10:20:00Z",
      });
      await cronjobPapers({ id: "dynamic-content" });
      expect(updatePlaylistMock).not.toHaveBeenCalled();
      expect(uploadSingleImageFromWebsiteMock).not.toHaveBeenCalled();
      expect(updateOneMock).not.toHaveBeenCalled();
    },
  );

  it.each(["another-org", undefined, null])("does not process a slideshow with invalid organization %s", async (organization) => {
    const device = buildDevice();
    if (!organization) device.organization = organization as any;
    queryDevicesByUserMock.mockResolvedValue({ results: [device] });
    getByIdsMock.mockResolvedValue([{ ...buildPaper(), organization }]);
    await cronjobPapers({ id: "organization-boundary" });
    expect(updateNextSlideMock).not.toHaveBeenCalled();
    expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("prepares a slide up to five minutes before the device sync", async () => {
    const result = await cronjobPapers({
      id: "job-1",
      name: "papersCronjob",
    });

    expect(updateNextSlideMock).toHaveBeenCalledTimes(1);
    expect(updateNextSlideMock).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "paper-id" }),
      expect.objectContaining({ deviceId: "epd13-test" }),
      "cronjob-slideshow",
      expect.any(Function),
    );
    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "device-db-id" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.paperCronjobSync": expect.objectContaining({
            nextDeviceSync: "2026-08-07T10:05:00.000Z",
            status: "processing",
          }),
        }),
      }),
      expect.any(Object),
    );
    expect(updateOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        "meta.paperCronjobSync.nextDeviceSync": "2026-08-07T10:05:00.000Z",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "meta.paperCronjobSync.status": "completed",
        }),
      }),
    );
    expect(result.meta.devices).toMatchObject({
      dueForSync: 1,
      alreadyPrepared: 0,
      statusUnavailable: 0,
    });
  });

  it.each(["1786097100", "1786097100000"])("prepares a refresh when the device returns Unix time as %s", async (nextDeviceSync) => {
    populateDeviceStatusMock.mockResolvedValue({ nextDeviceSync });
    const pending = cronjobPapers({ id: "string-timestamp" });
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.meta.errors).toEqual([]);
    expect(updateNextSlideMock).toHaveBeenCalledOnce();
  });

  it("uses the upcoming wakeup time for playlists", async () => {
    getByIdsMock.mockResolvedValue([{ ...buildPaper(), kind: "playlist" }]);
    updatePlaylistMock.mockResolvedValue({ selectedPaperId: "scheduled-paper" });
    await cronjobPapers({ id: "playlist-wakeup" });
    expect(updatePlaylistMock).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), "cronjob-playlist", new Date("2026-08-07T10:05:00.000Z"),
    );
  });

  it("releases the refresh lock when a playlist has no active entry", async () => {
    getByIdsMock.mockResolvedValue([{ ...buildPaper(), kind: "playlist" }]);
    updatePlaylistMock.mockResolvedValue({ message: "Playlist has no active entry" });
    await cronjobPapers({ id: "empty-playlist" });
    expect(updateOneMock).toHaveBeenCalledOnce();
    expect(updateOneMock).toHaveBeenCalledWith(expect.any(Object), {
      $unset: { "meta.paperCronjobSync": "" },
    });
  });

  it.each([
    "2026-08-07T10:05:00.001Z",
    "2026-08-07T13:00:00.000Z",
    "2026-08-08T10:00:00.000Z",
  ])(
    "does not prepare the future sync %s too early",
    async (nextDeviceSync) => {
      populateDeviceStatusMock.mockResolvedValue({
        nextDeviceSync,
      });

      const result = await cronjobPapers({
        id: "job-outside-window",
        name: "papersCronjob",
      });

      expect(findOneAndUpdateMock).not.toHaveBeenCalled();
      expect(updateNextSlideMock).not.toHaveBeenCalled();
      expect(result.meta.devices).toMatchObject({
        dueForSync: 0,
        outsideSyncWindow: 1,
      });
    },
  );

  it.each([1, 20, 180, 1440])(
    "catches up an unprepared sync that is %i minutes overdue",
    async (minutes) => {
      populateDeviceStatusMock.mockResolvedValue({
        nextDeviceSync: new Date(Date.now() - minutes * 60_000).toISOString(),
      });
      const result = await cronjobPapers({ id: "delayed-job" });
      expect(updateNextSlideMock).toHaveBeenCalledOnce();
      expect(result.meta.devices.dueForSync).toBe(1);
    },
  );

  it("does not advance again when an overdue sync was already prepared", async () => {
    populateDeviceStatusMock.mockResolvedValue({ nextDeviceSync: "2026-08-07T08:00:00.000Z" });
    findOneAndUpdateMock.mockResolvedValue(null);
    const result = await cronjobPapers({ id: "already-caught-up" });
    expect(findOneAndUpdateMock).toHaveBeenCalledOnce();
    expect(updateNextSlideMock).not.toHaveBeenCalled();
    expect(result.meta.devices.alreadyPrepared).toBe(1);
  });

  it("can recover a stale processing claim after the original preparation window", async () => {
    const device = buildDevice();
    const nextDeviceSync = "2026-08-07T09:45:00.000Z";
    device.meta = { paperCronjobSync: {
      nextDeviceSync, paperId: "paper-id", status: "processing",
      claimedAt: new Date("2026-08-07T09:40:00.000Z"),
    } };
    queryDevicesByUserMock.mockResolvedValue({ results: [device] });
    populateDeviceStatusMock.mockResolvedValue({ nextDeviceSync });
    await cronjobPapers({ id: "recovered-worker" });
    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ $or: expect.arrayContaining([
        expect.objectContaining({
          "meta.paperCronjobSync.nextDeviceSync": nextDeviceSync,
          "meta.paperCronjobSync.status": "processing",
          "meta.paperCronjobSync.claimedAt": { $lt: new Date("2026-08-07T09:45:00.000Z") },
        }),
      ]) }), expect.any(Object), expect.any(Object),
    );
    expect(updateNextSlideMock).toHaveBeenCalledOnce();
  });

  it("uses the current time when catching up an overdue playlist", async () => {
    getByIdsMock.mockResolvedValue([{ ...buildPaper(), kind: "playlist" }]);
    populateDeviceStatusMock.mockResolvedValue({ nextDeviceSync: "2026-08-06T10:00:00.000Z" });
    updatePlaylistMock.mockResolvedValue({ selectedPaperId: "current-entry" });
    await cronjobPapers({ id: "overdue-playlist" });
    expect(updatePlaylistMock).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), "cronjob-playlist", new Date("2026-08-07T10:00:00.000Z"),
    );
  });

  it("can inspect production-shaped data without claims, writes, or uploads", async () => {
    const result = await cronjobPapers({
      id: "job-dry-run",
      name: "papersCronjob",
      data: { dryRun: true },
    });

    expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    expect(updateOneMock).not.toHaveBeenCalled();
    expect(updateNextSlideMock).not.toHaveBeenCalled();
    expect(result.meta.dryRun).toBe(true);
    expect(result.meta.devices.dueForSync).toBe(1);
    expect(result.meta.updatedEntries).toEqual([
      expect.objectContaining({
        deviceId: "device-db-id",
        paperId: "paper-id",
        action: "slides",
        updateResult: expect.objectContaining({
          dryRun: true,
          nextDeviceSync: "2026-08-07T10:05:00.000Z",
        }),
      }),
    ]);
  });

  it("does not prepare the same predicted sync twice", async () => {
    findOneAndUpdateMock.mockResolvedValue(null);

    const result = await cronjobPapers({
      id: "job-2",
      name: "papersCronjob",
    });

    expect(updateNextSlideMock).not.toHaveBeenCalled();
    expect(result.meta.devices).toMatchObject({
      dueForSync: 0,
      alreadyPrepared: 1,
    });
  });

  it("allows newly selected content after another paper was prepared for this sync", async () => {
    // Emulate the database predicate against a completed claim for the old paper.
    const oldClaim = {
      nextDeviceSync: "2026-08-07T10:05:00.000Z",
      paperId: "previous-paper",
      status: "completed",
    };
    findOneAndUpdateMock.mockImplementation(async (filter) => {
      const eligible = filter.$or.some((branch: Record<string, any>) =>
        Object.entries(branch).every(([path, condition]) => {
          const actual = oldClaim[path.split(".").pop() as keyof typeof oldClaim];
          return condition && typeof condition === "object" && "$ne" in condition
            ? actual !== condition.$ne
            : actual === condition;
        }),
      );
      return eligible ? { _id: "device-db-id" } : null;
    });
    const result = await cronjobPapers({ id: "new-paper" });
    expect(updateNextSlideMock).toHaveBeenCalledOnce();
    expect(result.meta.devices.alreadyPrepared).toBe(0);
    expect(findOneAndUpdateMock.mock.calls[0][0].paper).toBe("paper-id");
  });

  it.each([null, { nextDeviceSync: 0 }, { nextDeviceSync: "0" }])("reports missing or unset device status %j instead of uploading", async (deviceStatus) => {
    populateDeviceStatusMock.mockResolvedValue(deviceStatus);

    const resultPromise = cronjobPapers({
      id: "job-3",
      name: "papersCronjob",
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(populateDeviceStatusMock).toHaveBeenCalledTimes(3);
    expect(updateNextSlideMock).not.toHaveBeenCalled();
    expect(result.meta.devices.statusUnavailable).toBe(1);
    expect(result.meta.errors).toEqual([
      {
        deviceId: "epd13-test",
        message:
          "Device status is missing a valid nextDeviceSync after 3 attempts",
      },
    ]);
  });

  it("times out device status requests so one device cannot stall the worker", async () => {
    populateDeviceStatusMock.mockImplementation(
      () => new Promise(() => undefined),
    );

    const resultPromise = cronjobPapers({
      id: "job-status-timeout",
      name: "papersCronjob",
    });
    await vi.waitFor(() =>
      expect(populateDeviceStatusMock).toHaveBeenCalledTimes(1),
    );
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await vi.advanceTimersByTimeAsync(10_000);
      if (attempt < 3) {
        await vi.waitFor(() =>
          expect(populateDeviceStatusMock).toHaveBeenCalledTimes(attempt + 1),
        );
      }
    }
    const result = await resultPromise;

    expect(populateDeviceStatusMock).toHaveBeenCalledTimes(3);
    expect(updateNextSlideMock).not.toHaveBeenCalled();
    expect(result.meta.devices.statusUnavailable).toBe(1);
    expect(result.meta.errors).toEqual([
      {
        deviceId: "epd13-test",
        message:
          "Device status is missing a valid nextDeviceSync after 3 attempts: Device status request timed out after 10000ms",
      },
    ]);
  });

  it("releases the sync claim when preparing the slide fails", async () => {
    updateNextSlideMock.mockRejectedValue(new Error("render failed"));

    const result = await cronjobPapers({
      id: "job-4",
      name: "papersCronjob",
    });

    expect(updateOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        "meta.paperCronjobSync.status": "processing",
      }),
      expect.objectContaining({
        $set: { "meta.paperCronjobSync.status": "pending" },
      }),
    );
    expect(result.meta.errors).toEqual([
      { deviceId: "epd13-test", message: "render failed" },
    ]);
  });
});
