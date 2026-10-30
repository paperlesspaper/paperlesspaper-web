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
  const { default: Device } = await import(
    "@internetderdinge/api/src/devices/devices.model.ts"
  );
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
      mocks.status.mockImplementation(async () => ({ nextDeviceSync }));
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
        (await Device.findById(device.id))?.meta?.paperCronjobSync.status
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
        }
      );
      expect(
        (await cronjobPapers({ id: "restart" })).meta.devices.alreadyPrepared
      ).toBe(1);
      expect(mocks.upload).not.toHaveBeenCalled();
      await Device.updateOne(
        { _id: device.id },
        {
          $set: {
            "meta.paperCronjobSync.claimedAt": new Date(
              Date.now() - 16 * 60_000
            ),
          },
        }
      );
      expect((await cronjobPapers({ id: "recovery" })).meta.errors).toEqual([]);
      expect(mocks.upload).toHaveBeenCalledOnce();
    });
    it("releases failed render claims so the next cronjob retries the same cycle", async () => {
      mocks.upload.mockRejectedValueOnce(new Error("Renderer request failed"));
      expect(
        (await cronjobPapers({ id: "renderer-down" })).meta.errors
      ).toHaveLength(1);
      expect(
        (await Device.findById(device.id))?.meta?.paperCronjobSync
      ).toBeUndefined();
      expect(
        (await cronjobPapers({ id: "renderer-restored" })).meta.errors
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
    it("keeps dry-run completely read-only", async () => {
      const before = await Device.collection.findOne({ _id: device._id });
      expect(
        (await cronjobPapers({ data: { dryRun: true } })).meta.devices
          .dueForSync
      ).toBe(1);
      expect(await Device.collection.findOne({ _id: device._id })).toEqual(
        before
      );
      expect(mocks.upload).not.toHaveBeenCalled();
    });
  }
);
