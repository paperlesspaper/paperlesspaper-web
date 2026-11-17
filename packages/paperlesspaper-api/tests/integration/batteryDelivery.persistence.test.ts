import mongoose from "mongoose";
import { createHash } from "node:crypto";
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
  warning: "low" as const,
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
    it("suppresses repeats for three weeks while allowing separate recipients and channels", async () => {
      const send = vi.fn(async () => true);
      expect(BATTERY_REMINDER_MS).toBe(21 * 24 * 60 * 60_000);
      await deliverBatteryOnce(identity, send);
      const record = await BatteryDelivery.findOne().lean();
      expect(
        await deliverBatteryOnce(
          identity,
          send,
          new Date(record!.lastSentAt!.getTime() + BATTERY_REMINDER_MS - 1)
        )
      ).toBe(false);
      expect(
        await deliverBatteryOnce(
          identity,
          send,
          new Date(record!.lastSentAt!.getTime() + BATTERY_REMINDER_MS)
        )
      ).toBe(true);
      expect(
        await deliverBatteryOnce({ ...identity, warning: "empty" }, send)
      ).toBe(true);
      expect(
        await deliverBatteryOnce({ ...identity, warning: "empty" }, send)
      ).toBe(false);
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
    it("extends an existing low-warning receipt to 21 days without resending after 48 hours", async () => {
      const oldId = createHash("sha256")
        .update(
          JSON.stringify([
            identity.organization,
            identity.device,
            identity.user,
            identity.channel,
          ])
        )
        .digest("hex");
      const lastSentAt = new Date(Date.now() - 3 * 86_400_000);
      await BatteryDelivery.create({ _id: oldId, lastSentAt });
      const send = vi.fn(async () => true);
      expect(await deliverBatteryOnce(identity, send)).toBe(false);
      expect(send).not.toHaveBeenCalled();
      expect(
        await deliverBatteryOnce({ ...identity, warning: "empty" }, send)
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
        {
          $set: {
            low: { email: true, push: false },
            empty: { email: false, push: true },
          },
        },
        { upsert: true }
      );
      expect(
        await BatteryPreference.findById(identity.user).lean()
      ).toMatchObject({
        low: { email: true, push: false },
        empty: { email: false, push: true },
      });
      await BatteryPreference.updateOne(
        { _id: identity.user },
        {
          $set: {
            low: { email: false, push: true },
            empty: { email: true, push: false },
          },
        }
      );
      expect(
        await BatteryPreference.findById(identity.user).lean()
      ).toMatchObject({
        low: { email: false, push: true },
        empty: { email: true, push: false },
      });
      expect(await BatteryPreference.countDocuments()).toBe(1);
    });
  }
);
