import mongoose from "mongoose";

// Keep the confirmed reset separate from Device.meta: ordinary device saves
// must not erase the information needed to resume database cleanup.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    deviceId: { type: String, required: true, index: true },
    preview: { type: mongoose.Schema.Types.Mixed, required: true },
    result: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default mongoose.models.DeviceDeactivation ||
  mongoose.model("DeviceDeactivation", schema);
