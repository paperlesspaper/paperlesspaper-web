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
    updateOneMock.mockResolvedValue({ acknowledged: true });
    updateNextSlideMock.mockResolvedValue({ selectedPaperId: "image-id" });
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

  it("does not prepare content outside the five-minute window", async () => {
    populateDeviceStatusMock.mockResolvedValue({
      nextDeviceSync: "2026-08-07T10:05:00.001Z",
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

  it("retries missing device status and reports it instead of silently skipping", async () => {
    populateDeviceStatusMock.mockResolvedValue(null);

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
      { $unset: { "meta.paperCronjobSync": "" } },
    );
    expect(result.meta.errors).toEqual([
      { deviceId: "epd13-test", message: "render failed" },
    ]);
  });
});
