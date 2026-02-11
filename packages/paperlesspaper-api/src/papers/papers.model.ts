import mongoose, { type Schema, type Model } from "mongoose";
import { paginate, toJSON } from "@internetderdinge/api";

const papersSchema: Schema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    deviceId: { type: mongoose.Schema.Types.ObjectId },
    kind: { type: String },
    meta: { type: Object },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    draft: { type: Boolean, default: false },
    imageUpdatedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      timestamps: true,
    },
  },
);

// Add plugins that convert mongoose to JSON and enable pagination
papersSchema.plugin(toJSON, true);
papersSchema.plugin(paginate);

/**
 * Papers model
 */
const Papers: Model<any> = mongoose.model("Papers", papersSchema);

export default Papers;
