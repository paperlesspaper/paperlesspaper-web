import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  papers: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@internetderdinge/api", async () => {
  const { default: Device } =
    await import("@internetderdinge/api/src/devices/devices.model.ts");
  return {
    Device,
    devicesService: {
      queryDevicesByUser: async () => ({ results: await Device.find({}) }),
      populateDeviceStatus: mocks.status,
    },
  };
});
vi.mock("../../src/papers/papers.service.ts", () => ({
  default: {
    getByIds: mocks.papers,
    updateNextSlide: mocks.upload,
  },
}));
import { Device } from "@internetderdinge/api";
import { cronjobPapers } from "../../src/cronjobs/papers.cronjob";

const url = process.env.CRONJOB_TEST_MONGODB_URL;
describe.skipIf(!url)(
  "cronjob claims across API restarts (real MongoDB)",
  () => {
    let device: any;
    let paperId: mongoose.Types.ObjectId;
    let nextDeviceSync: string;
    beforeAll(async () => {
      if (!new URL(url!).pathname.startsWith("/paperless-cronjob-test-"))
        throw new Error("Use a disposable paperless-cronjob-test-* database");
      await mongoose.connect(url!);
      await Device.init();
    });
    afterAll(async () => {
      await mongoose.disconnect();
    });
    beforeEach(async () => {
      vi.resetAllMocks();
      await Device.deleteMany({});
      paperId = new mongoose.Types.ObjectId();
      device = await Device.create({
        deviceId: "epd7-cronjob-test",
        organization: new mongoose.Types.ObjectId(),
        kind: "epd7",
        paper: paperId,
      });
      nextDeviceSync = new Date(Date.now() - 20 * 60_000).toISOString();
      mocks.status.mockImplementation(async () => ({ nextDeviceSync, organizationName: String(device.organization) }));
      mocks.papers.mockImplementation(async () => [
        { _id: paperId, organization: device.organization, kind: "slides" },
      ]);
      mocks.upload.mockResolvedValue({ selectedPaperId: "image-1" });
    });
    it("prepares overdue content once even when two workers race and a new worker reloads it", async () => {
      const runs = await Promise.all([
        cronjobPapers({ id: "old" }),
        cronjobPapers({ id: "new" }),
      ]);
      expect(runs.flatMap((r) => r.meta.errors)).toEqual([]);
      expect(mocks.upload).toHaveBeenCalledOnce();
      const restarted = await cronjobPapers({ id: "restart" });
      expect(restarted.meta.devices.alreadyPrepared).toBe(1);
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(
        (await Device.findById(device.id))?.meta?.paperCronjobSync.status,
      ).toBe("completed");
      nextDeviceSync = new Date(Date.now() + 60_000).toISOString();
      await cronjobPapers({ id: "next-cycle" });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
    });
    it("keeps a recent interrupted claim and reclaims it after 15 minutes", async () => {
      await Device.updateOne(
        { _id: device.id },
        {
          $set: {
            "meta.paperCronjobSync": {
              paperId: String(paperId),
              nextDeviceSync,
              status: "processing",
              claimedAt: new Date(),
              jobId: "killed-api",
            },
          },
        },
      );
      expect(
        (await cronjobPapers({ id: "restart" })).meta.devices.alreadyPrepared,
      ).toBe(1);
      expect(mocks.upload).not.toHaveBeenCalled();
      await Device.updateOne(
        { _id: device.id },
        {
          $set: {
            "meta.paperCronjobSync.claimedAt": new Date(
              Date.now() - 16 * 60_000,
            ),
          },
        },
      );
      expect((await cronjobPapers({ id: "recovery" })).meta.errors).toEqual([]);
      expect(mocks.upload).toHaveBeenCalledOnce();
    });
    it("releases failed render claims so the next cronjob retries the same cycle", async () => {
      mocks.upload.mockRejectedValueOnce(new Error("Renderer request failed"));
      expect(
        (await cronjobPapers({ id: "renderer-down" })).meta.errors,
      ).toHaveLength(1);
      expect(
        (await Device.findById(device.id))?.meta?.paperCronjobSync,
      ).toMatchObject({ status: "pending", nextDeviceSync });
      expect(
        (await cronjobPapers({ id: "renderer-restored" })).meta.errors,
      ).toEqual([]);
      expect(mocks.upload).toHaveBeenCalledTimes(2);
    });
    it("preserves the claim when the upload saves the loaded device document", async () => {
      mocks.upload.mockImplementation(async (_paper, loadedDevice) => {
        loadedDevice.meta.otherSetting = "preserved";
        loadedDevice.markModified("meta");
        await loadedDevice.save();
        return { selectedPaperId: "image-1" };
      });
      await cronjobPapers({ id: "save-during-upload" });
      await cronjobPapers({ id: "restart" });
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect((await Device.findById(device.id))?.meta).toMatchObject({
        otherSetting: "preserved",
        paperCronjobSync: { status: "completed" },
      });
    });
    it("keeps a future cycle across restart and an early contact that advances nextSync", async () => {
      await Device.updateOne(
        { _id: device.id },
        { $set: { "meta.sleepTime": 28800 } },
      );
      const due = new Date(Date.now() + 11 * 60_000).toISOString();
      nextDeviceSync = due;
      expect(
        (await cronjobPapers({ id: "observe-before-window" })).meta.devices
          .outsideSyncWindow,
      ).toBe(1);
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({
        status: "pending",
        nextDeviceSync: due,
      });
      // Simulate elapsed time by moving the saved due date just inside the window.
      const outstanding = new Date(Date.now() + 9 * 60_000).toISOString();
      await Device.updateOne(
        { _id: device.id },
        { $set: { "meta.paperCronjobSync.nextDeviceSync": outstanding } },
      );
      nextDeviceSync = new Date(Date.now() + 8 * 3600_000).toISOString();
      expect(
        (await cronjobPapers({ id: "early-contact" })).meta.errors,
      ).toEqual([]);
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({
        status: "completed",
        nextDeviceSync: outstanding,
      });
      await cronjobPapers({ id: "next-scan" });
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({
        status: "completed",
        nextDeviceSync: outstanding,
        coveredThrough: nextDeviceSync,
      });
      nextDeviceSync = new Date(Date.now() + 16 * 3600_000).toISOString();
      await cronjobPapers({ id: "after-next-device-contact" });
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({ status: "pending", nextDeviceSync });
    });

    it("retries a failed cycle after nextSync changes, without replaying multiple missed slides", async () => {
      const due = nextDeviceSync;
      mocks.upload.mockRejectedValueOnce(new Error("Renderer unavailable"));
      await cronjobPapers({ id: "failure" });
      nextDeviceSync = new Date(Date.now() + 24 * 3600_000).toISOString();
      await cronjobPapers({ id: "retry-new-prediction" });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({
        status: "completed",
        nextDeviceSync: due,
      });
      await cronjobPapers({ id: "no-backlog" });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
    });

    it("retains the outstanding cycle through a stale processing lease and a new prediction", async () => {
      const due = nextDeviceSync;
      await Device.updateOne(
        { _id: device.id },
        {
          $set: {
            "meta.paperCronjobSync": {
              paperId: String(paperId),
              nextDeviceSync: due,
              status: "processing",
              claimedAt: new Date(Date.now() - 16 * 60_000),
              leaseId: "old-worker",
            },
          },
        },
      );
      nextDeviceSync = new Date(Date.now() + 8 * 3600_000).toISOString();
      mocks.upload.mockRejectedValueOnce(new Error("still unavailable"));
      await cronjobPapers({ id: "stale-retry-failed" });
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({ status: "pending", nextDeviceSync: due });
      await cronjobPapers({ id: "stale-retry-success" });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync.status,
      ).toBe("completed");
    });

    it("does not overwrite a live lease when nextSync changes", async () => {
      let release!: () => void;
      const blocked = new Promise<void>((r) => {
        release = r;
      });
      mocks.upload.mockImplementationOnce(async () => {
        await blocked;
        return { selectedPaperId: "image-1" };
      });
      const first = cronjobPapers({ id: "slow-upload" });
      await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
      nextDeviceSync = new Date(Date.now() + 60_000).toISOString();
      await cronjobPapers({ id: "different-prediction" });
      expect(mocks.upload).toHaveBeenCalledOnce();
      release();
      await first;
    });

    it.each(["sleepTime", "updateSchedule"])(
      "discards a pending prediction after changing %s",
      async (setting) => {
        await cronjobPapers({ data: { dryRun: true } });
        mocks.upload.mockRejectedValueOnce(new Error("failed-old-settings"));
        await cronjobPapers({ id: "old-settings" });
        await Device.updateOne(
          { _id: device.id },
          {
            $set: {
              [`meta.${setting}`]:
                setting === "sleepTime"
                  ? 86400
                  : { enabled: true, windows: [] },
            },
          },
        );
        nextDeviceSync = new Date(Date.now() + 24 * 3600_000).toISOString();
        await cronjobPapers({ id: "new-settings" });
        expect(mocks.upload).toHaveBeenCalledOnce();
        expect(
          (await Device.findById(device.id))?.meta.paperCronjobSync,
        ).toMatchObject({ status: "pending", nextDeviceSync });
      },
    );

    it("discards an old slideshow's pending cycle when another slideshow is selected", async () => {
      mocks.upload.mockRejectedValueOnce(new Error("failed-old-show"));
      await cronjobPapers({ id: "old-show" });
      paperId = new mongoose.Types.ObjectId();
      await Device.updateOne({ _id: device.id }, { $set: { paper: paperId } });
      nextDeviceSync = new Date(Date.now() + 8 * 3600_000).toISOString();
      await cronjobPapers({ id: "new-show" });
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({
        status: "pending",
        paperId: String(paperId),
        nextDeviceSync,
      });
    });

    it("does not let an expired worker complete a newer lease", async () => {
      mocks.upload.mockImplementationOnce(async () => {
        await Device.updateOne(
          { _id: device.id },
          {
            $set: {
              "meta.paperCronjobSync.leaseId": "replacement-worker",
              "meta.paperCronjobSync.status": "processing",
            },
          },
        );
        return { selectedPaperId: "image-1" };
      });
      await cronjobPapers({ id: "expired-worker" });
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({ status: "processing", leaseId: "replacement-worker" });
    });

    it("does not resurrect an old processing cycle from a delayed scan after another worker completed it", async () => {
      const due = nextDeviceSync;
      await Device.updateOne(
        { _id: device.id },
        {
          $set: {
            "meta.paperCronjobSync": {
              paperId: String(paperId),
              nextDeviceSync: due,
              status: "processing",
              claimedAt: new Date(Date.now() - 16 * 60_000),
              leaseId: "interrupted",
            },
          },
        },
      );
      let resume!: () => void;
      let entered!: () => void;
      const waiting = new Promise<void>((r) => {
        entered = r;
      });
      const blocked = new Promise<void>((r) => {
        resume = r;
      });
      mocks.status.mockImplementationOnce(async () => {
        entered();
        await blocked;
        return { nextDeviceSync: due };
      });
      const delayed = cronjobPapers({ id: "delayed-old-scan" });
      await waiting;
      await cronjobPapers({ id: "complete-old-cycle" });
      expect(mocks.upload).toHaveBeenCalledOnce();
      nextDeviceSync = new Date(Date.now() + 8 * 3600_000).toISOString();
      await cronjobPapers({ id: "remember-new-cycle" });
      resume();
      await delayed;
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({ status: "pending", nextDeviceSync });
    });

    it("does not let an expired failed worker release a replacement lease", async () => {
      mocks.upload.mockImplementationOnce(async () => {
        await Device.updateOne(
          { _id: device.id },
          { $set: { "meta.paperCronjobSync.leaseId": "replacement" } },
        );
        throw new Error("old request failed");
      });
      await cronjobPapers({ id: "old-failure" });
      expect(
        (await Device.findById(device.id))?.meta.paperCronjobSync,
      ).toMatchObject({ status: "processing", leaseId: "replacement" });
    });

    it("honors a completed legacy claim without preparing it again", async () => {
      await Device.updateOne(
        { _id: device.id },
        {
          $set: {
            "meta.paperCronjobSync": {
              paperId: String(paperId),
              nextDeviceSync,
              status: "completed",
              completedAt: new Date(),
            },
          },
        },
      );
      await cronjobPapers({ id: "after-upgrade" });
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("does not persist future observations during a dry run", async () => {
      nextDeviceSync = new Date(Date.now() + 3600_000).toISOString();
      const before = await Device.collection.findOne({ _id: device._id });
      await cronjobPapers({ data: { dryRun: true } });
      expect(await Device.collection.findOne({ _id: device._id })).toEqual(
        before,
      );
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("does not overwrite an unseen catch-up slide at the following device cycle", async () => {
      mocks.upload.mockRejectedValueOnce(new Error("first attempt failed"));
      await cronjobPapers({ id: "missed-cycle" });
      nextDeviceSync = new Date(Date.now() + 2 * 60_000).toISOString();
      await cronjobPapers({ id: "catch-up-for-next-contact" });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
      await cronjobPapers({ id: "still-before-next-contact" });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
    });

    it("adopts an earlier prediction instead of waiting for the old distant deadline", async () => {
      nextDeviceSync = new Date(Date.now() + 8 * 3600_000).toISOString();
      await cronjobPapers({ id: "distant-prediction" });
      nextDeviceSync = new Date(Date.now() + 60_000).toISOString();
      await cronjobPapers({ id: "earlier-prediction" });
      expect(mocks.upload).toHaveBeenCalledOnce();
    });

    it("does not start an upload from settings changed while device status was loading", async () => {
      mocks.status.mockImplementationOnce(async () => {
        await Device.updateOne(
          { _id: device.id },
          { $set: { "meta.sleepTime": 86400 } },
        );
        return { nextDeviceSync };
      });
      await cronjobPapers({ id: "settings-race" });
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("does not save an old lease back when a subsequent helper saves a different metadata path", async () => {
      mocks.upload.mockImplementationOnce(async (_paper, loadedDevice) => {
        await Device.updateOne(
          { _id: device.id },
          {
            $set: {
              "meta.paperCronjobSync.leaseId": "replacement-lease",
              "meta.sleepTime": 86400,
            },
          },
        );
        loadedDevice.set("meta.currentFrameImagePending", {
          paperId: String(paperId),
        });
        loadedDevice.markModified("meta.currentFrameImagePending");
        await loadedDevice.save();
        return { selectedPaperId: "image-1" };
      });
      await cronjobPapers({ id: "old-document-save" });
      expect((await Device.findById(device.id))?.meta).toMatchObject({
        sleepTime: 86400,
        paperCronjobSync: {
          status: "processing",
          leaseId: "replacement-lease",
        },
      });
    });

    it.each([
      [28800, 287.52, 600],
      [43200, 481.595, 900],
      [86400, 1070.764, 1500],
    ])(
      "replays the observed extreme for %s seconds with the real scheduler",
      async (interval, early, lead) => {
        // Anonymized extreme durations from the 2026-11-01 analysis, not a live device test.
        vi.useFakeTimers({ toFake: ["Date"] });
        try {
          const due = Date.parse("2026-11-01T12:00:00Z");
          const contact = due - early * 1000;
          const finished: number[] = [];
          await Device.updateOne(
            { _id: device.id },
            { $set: { "meta.sleepTime": interval } },
          );
          mocks.upload.mockImplementation(async () => {
            vi.setSystemTime(new Date(Date.now() + 60_000));
            finished.push(Date.now());
            return { selectedPaperId: "image-1" };
          });
          // One scan just outside the lead window; next opportunity nearly four minutes later.
          for (
            let t = due - lead * 1000 - 1000;
            t < contact + 240_000;
            t += 240_000
          ) {
            vi.setSystemTime(new Date(t));
            nextDeviceSync = new Date(
              t < contact ? due : contact + interval * 1000,
            ).toISOString();
            const result = await cronjobPapers({ id: "recorded-timeline" });
            expect(result.meta.errors).toEqual([]);
          }
          expect(finished).toHaveLength(1);
          expect(finished[0]).toBeLessThan(contact);
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it.each(["organization", "deviceId"])("rejects a stale worker after a privileged database change to target %s", async (field) => {
      mocks.status.mockImplementationOnce(async () => {
        await Device.collection.updateOne({ _id: device._id }, { $set: {
          [field]: field === "organization" ? new mongoose.Types.ObjectId() : "epd7-other-physical-frame",
        } });
        return { nextDeviceSync };
      });
      await cronjobPapers({ id: "ownership-race" });
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it.each(["takeover", "paper", "lease", "removed"])("stops an in-flight slideshow upload after %s", async (change) => {
      const transferred = new mongoose.Types.ObjectId();
      const sink = vi.fn();
      mocks.upload.mockImplementationOnce(async (_paper, loaded, _trigger, validateTarget) => {
        if (change === "takeover" || change === "removed") {
          await Device.deleteOne({ _id: loaded._id });
          if (change === "takeover") await Device.create({ deviceId: loaded.deviceId, organization: transferred, kind: "epd7" });
        } else if (change === "paper") {
          await Device.updateOne({ _id: loaded._id }, { $set: { paper: new mongoose.Types.ObjectId() } });
        } else {
          await Device.updateOne({ _id: loaded._id }, { $set: { "meta.paperCronjobSync.leaseId": "other-worker" } });
        }
        await validateTarget();
        sink(loaded.deviceId);
        return {};
      });
      const result = await cronjobPapers({ id: "changed-while-rendering" });
      expect(result.meta.errors).toHaveLength(1);
      expect(sink).not.toHaveBeenCalled();
      if (change === "takeover") {
        const replacement = await Device.findOne({ deviceId: device.deviceId });
        expect(String(replacement?.organization)).toBe(String(transferred));
        expect(replacement?.meta?.paperCronjobSync).toBeUndefined();
      }
    });

    it("keeps concurrent uploads bound to their own frames even when they share a slideshow", async () => {
      const second = await Device.create({ deviceId: "epd7-second-frame", organization: device.organization, paper: paperId, kind: "epd7" });
      const sink: string[] = [];
      mocks.upload.mockImplementation(async (_paper, loaded, _trigger, validateTarget) => {
        await validateTarget();
        sink.push(loaded.deviceId);
        return { selectedPaperId: "source-1" };
      });
      const result = await cronjobPapers({ id: "two-frame-upload" });
      expect(result.meta.errors).toEqual([]);
      expect(sink.sort()).toEqual([device.deviceId, second.deviceId].sort());
      expect((await Device.findById(device.id))?.meta.paperCronjobSync.leaseId)
        .not.toBe((await Device.findById(second.id))?.meta.paperCronjobSync.leaseId);
    });

    it.each(["another-organization", undefined, null])("rejects changed or unverifiable IoT ownership %s even while MongoDB still shows the old owner", async (organizationName) => {
      const sink = vi.fn();
      mocks.upload.mockImplementationOnce(async (_paper, _device, _trigger, validateTarget) => {
        mocks.status.mockResolvedValue({ nextDeviceSync, organizationName });
        await validateTarget();
        sink();
      });
      const result = await cronjobPapers({ id: "iot-takeover-before-local-save" });
      expect(result.meta.errors).toHaveLength(1);
      expect(sink).not.toHaveBeenCalled();
    });

    it("rechecks the local assignment after the remote ownership lookup finishes", async () => {
      const sink = vi.fn();
      mocks.upload.mockImplementationOnce(async (_paper, loaded, _trigger, validateTarget) => {
        mocks.status.mockImplementationOnce(async () => {
          await Device.deleteOne({ _id: loaded._id });
          return { nextDeviceSync, organizationName: String(loaded.organization) };
        });
        await validateTarget();
        sink();
      });
      expect((await cronjobPapers({ id: "takeover-during-status-request" })).meta.errors).toHaveLength(1);
      expect(sink).not.toHaveBeenCalled();
    });

    it.each(["removed", "transferred"])("rejects a slideshow %s while rendering", async (change) => {
      const sink = vi.fn();
      mocks.upload.mockImplementationOnce(async (_paper, _device, _trigger, validateTarget) => {
        mocks.papers.mockResolvedValue(change === "removed" ? [] : [{ _id: paperId, kind: "slides", organization: new mongoose.Types.ObjectId() }]);
        await validateTarget();
        sink();
      });
      expect((await cronjobPapers({ id: "parent-ownership-change" })).meta.errors).toHaveLength(1);
      expect(sink).not.toHaveBeenCalled();
    });

    it("keeps dry-run completely read-only", async () => {
      const before = await Device.collection.findOne({ _id: device._id });
      expect(
        (await cronjobPapers({ data: { dryRun: true } })).meta.devices
          .dueForSync,
      ).toBe(1);
      expect(await Device.collection.findOne({ _id: device._id })).toEqual(
        before,
      );
      expect(mocks.upload).not.toHaveBeenCalled();
    });
  },
);
