import mongoose from "mongoose";

// The _id index makes both account creation and lock acquisition atomic.
export const StorageAccount = mongoose.model(
  "StorageAccount",
  new mongoose.Schema({
    _id: { type: String, required: true },
    usedBytes: { type: Number, default: 0 },
    initialized: { type: Boolean, default: false },
    lockToken: String,
    lockedAt: Date,
  })
);

export const StorageObject = mongoose.model(
  "StorageObject",
  new mongoose.Schema({
    _id: { type: String, required: true },
    organization: { type: String, required: true, index: true },
    key: { type: String, required: true },
    bytes: { type: Number, required: true },
  })
);
