import mongoose from "mongoose";

interface Preference {
  _id: string;
  email?: boolean;
  push?: boolean;
  low?: { email: boolean; push: boolean };
  empty?: { email: boolean; push: boolean };
}
interface Delivery {
  _id: string;
  lastSentAt?: Date;
  leaseUntil?: Date;
  claim?: string;
}

// Explicit opt-in, separate from the shared library's legacy default-on settings.
const preferenceSchema = new mongoose.Schema<Preference>(
  {
    _id: String, // Auth0 subject
    email: Boolean, // Legacy low-battery preference, read without migrating data.
    push: Boolean,
    low: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
    empty: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

const deliverySchema = new mongoose.Schema<Delivery>(
  {
    _id: String, // Hash of organization, device, account and channel
    lastSentAt: Date,
    leaseUntil: Date,
    claim: String,
  },
  { timestamps: true }
);

export const BatteryPreference =
  (mongoose.models.BatteryPreference as mongoose.Model<Preference>) ||
  mongoose.model<Preference>("BatteryPreference", preferenceSchema);
export const BatteryDelivery =
  (mongoose.models.BatteryDelivery as mongoose.Model<Delivery>) ||
  mongoose.model<Delivery>("BatteryDelivery", deliverySchema);
