import { createHash, randomUUID } from "node:crypto";
import { BatteryDelivery } from "./batteryNotifications.model.js";

export const BATTERY_REMINDER_MS = 48 * 60 * 60_000;
const LEASE_MS = 10 * 60_000;

// Atomic per-channel claims survive restarts and overlapping cron workers.
export async function deliverBatteryOnce(
  identity: {
    organization: string;
    device: string;
    user: string;
    channel: "email" | "push";
  },
  send: () => Promise<boolean>,
  now = new Date()
) {
  const _id = createHash("sha256")
    .update(
      JSON.stringify([
        identity.organization,
        identity.device,
        identity.user,
        identity.channel,
      ])
    )
    .digest("hex");
  try {
    await BatteryDelivery.updateOne(
      { _id },
      { $setOnInsert: { _id } },
      { upsert: true }
    );
  } catch (error: any) {
    if (error.code !== 11000) throw error;
  }
  const claim = randomUUID();
  const receipt = await BatteryDelivery.findOneAndUpdate(
    {
      _id,
      $and: [
        {
          $or: [
            { lastSentAt: null },
            {
              lastSentAt: {
                $lte: new Date(now.getTime() - BATTERY_REMINDER_MS),
              },
            },
          ],
        },
        { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
      ],
    },
    { $set: { claim, leaseUntil: new Date(now.getTime() + LEASE_MS) } },
    { new: true }
  );
  if (!receipt) return false;
  try {
    const sent = await send();
    await BatteryDelivery.updateOne(
      { _id, claim },
      {
        ...(sent ? { $set: { lastSentAt: new Date() } } : {}),
        $unset: { claim: 1, leaseUntil: 1 },
      }
    );
    return sent;
  } catch (error) {
    await BatteryDelivery.updateOne(
      { _id, claim },
      { $unset: { claim: 1, leaseUntil: 1 } }
    );
    throw error;
  }
}
