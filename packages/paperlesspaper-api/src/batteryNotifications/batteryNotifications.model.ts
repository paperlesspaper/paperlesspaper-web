import mongoose from "mongoose";

interface Preference {
  _id: string;
  email: boolean;
  push: boolean;
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
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
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
