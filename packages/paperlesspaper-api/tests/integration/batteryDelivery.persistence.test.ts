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
import {
  BatteryDelivery,
  BatteryPreference,
} from "../../src/batteryNotifications/batteryNotifications.model.js";
import {
  BATTERY_REMINDER_MS,
  deliverBatteryOnce,
} from "../../src/batteryNotifications/batteryDelivery.service.js";
const databaseUrl = process.env.BATTERY_TEST_MONGODB_URL;
const identity = {
  organization: "org",
  device: "device",
  user: "auth0|test",
  channel: "email" as const,
};

describe.skipIf(!databaseUrl)(
  "battery delivery receipts (isolated MongoDB)",
  () => {
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        !url.pathname.startsWith("/paperless-battery-test-")
      )
        throw new Error(
          "Use a disposable local paperless-battery-test-* database."
        );
      await mongoose.connect(databaseUrl!);
    });
    beforeEach(async () => {
      await BatteryDelivery.deleteMany({});
      await BatteryPreference.deleteMany({});
    });
    afterAll(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    it("atomically sends once even across 20 simultaneous first deliveries", async () => {
      const send = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return true;
      });
      const result = await Promise.all(
        Array.from({ length: 20 }, () => deliverBatteryOnce(identity, send))
      );
      expect(result.filter(Boolean)).toHaveLength(1);
      expect(send).toHaveBeenCalledOnce();
      expect(await deliverBatteryOnce(identity, send)).toBe(false);
    });
    it("suppresses repeats for 48 hours while allowing separate recipients and channels", async () => {
      const send = vi.fn(async () => true);
      await deliverBatteryOnce(identity, send);
      const record = await BatteryDelivery.findOne().lean();
      expect(
        await deliverBatteryOnce(
          identity,
          send,
          new Date(record!.lastSentAt.getTime() + BATTERY_REMINDER_MS - 1)
        )
      ).toBe(false);
      expect(
        await deliverBatteryOnce(
          identity,
          send,
          new Date(record!.lastSentAt.getTime() + BATTERY_REMINDER_MS)
        )
      ).toBe(true);
      expect(
        await deliverBatteryOnce({ ...identity, channel: "push" }, send)
      ).toBe(true);
      expect(
        await deliverBatteryOnce({ ...identity, user: "auth0|other" }, send)
      ).toBe(true);
      expect(
        await deliverBatteryOnce({ ...identity, organization: "other" }, send)
      ).toBe(true);
    });
    it("releases a failed attempt so it can be retried without suppressing another channel", async () => {
      await expect(
        deliverBatteryOnce(identity, async () => {
          throw new Error("SES unavailable");
        })
      ).rejects.toThrow("SES unavailable");
      expect(await deliverBatteryOnce(identity, async () => true)).toBe(true);
      expect(
        await deliverBatteryOnce(
          { ...identity, channel: "push" },
          async () => true
        )
      ).toBe(true);
    });
    it("does not record opt-outs, missing tokens or other skipped sends as delivered", async () => {
      expect(await deliverBatteryOnce(identity, async () => false)).toBe(false);
      expect(
        (await BatteryDelivery.findOne().lean())!.lastSentAt
      ).toBeUndefined();
      expect(await deliverBatteryOnce(identity, async () => true)).toBe(true);
    });
    it("recovers a lease after a crashed worker without accepting a concurrent worker", async () => {
      await deliverBatteryOnce(identity, async () => false);
      await BatteryDelivery.updateMany(
        {},
        {
          $set: { claim: "crashed", leaseUntil: new Date(Date.now() + 60_000) },
        }
      );
      expect(await deliverBatteryOnce(identity, async () => true)).toBe(false);
      await BatteryDelivery.updateMany(
        {},
        { $set: { leaseUntil: new Date(Date.now() - 1) } }
      );
      expect(await deliverBatteryOnce(identity, async () => true)).toBe(true);
    });
    it("persists opt-in without creating or requiring a push token record", async () => {
      await BatteryPreference.updateOne(
        { _id: identity.user },
        { $set: { email: true, push: false } },
        { upsert: true }
      );
      expect(
        await BatteryPreference.findById(identity.user).lean()
      ).toMatchObject({ email: true, push: false });
      await BatteryPreference.updateOne(
        { _id: identity.user },
        { $set: { email: false, push: true } }
      );
      expect(
        await BatteryPreference.findById(identity.user).lean()
      ).toMatchObject({ email: false, push: true });
      expect(await BatteryPreference.countDocuments()).toBe(1);
    });
  }
);
