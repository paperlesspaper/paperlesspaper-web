import mongoose from "mongoose";
const { Schema } = mongoose;
const model = (name: string, schema: any): any =>
  mongoose.models[name] || mongoose.model(name, schema);

const connection = new Schema(
  {
    paperId: { type: Schema.Types.ObjectId, required: true },
    organization: { type: Schema.Types.ObjectId, required: true },
    owner: { type: String, required: true },
    source: { type: String, required: true },
    generation: { type: String, required: true },
    callbackUrl: { type: String, required: true },
    tokenHash: { type: String, required: true },
    tokenSecret: { type: String, required: true, select: false },
    callbackToken: { type: String, required: true, select: false },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);
connection.index({ paperId: 1, owner: 1 }, { unique: true });
export const PushConnection = model("IntegrationPushConnection", connection);

export const PushGrant = model(
  "IntegrationPushGrant",
  new Schema({
    _id: String,
    owner: String,
    paperId: Schema.Types.ObjectId,
    source: String,
    expiresAt: { type: Date, expires: 0 },
  })
);

const request = new Schema(
  {
    _id: String,
    connectionId: Schema.Types.ObjectId,
    connectionGeneration: String,
    paperId: Schema.Types.ObjectId,
    messageId: String,
    fingerprint: String,
    text: String,
    imageKey: String,
    source: String,
    state: { type: String, default: "receiving" },
    nextCheckAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, expires: 0 },
  },
  { timestamps: true }
);
request.index({ state: 1, nextCheckAt: 1, createdAt: 1, _id: 1 });
request.index({ connectionId: 1, connectionGeneration: 1, createdAt: -1 });
export const PushRequest = model("IntegrationPushRequest", request);

export const PushContent = model(
  "IntegrationPushContent",
  new Schema({
    _id: Schema.Types.ObjectId, // One source per paper, shared by its frames.
    revision: String,
    text: String,
    imageKey: String,
    source: String,
    receivedAt: Date,
  })
);

const delivery = new Schema(
  {
    _id: String,
    requestId: String,
    deviceId: Schema.Types.ObjectId,
    frameName: String,
    state: { type: String, default: "pending" },
    attempts: { type: Number, default: 0 },
    startedAt: Date,
    previousFileVersion: Number,
    expiresAt: { type: Date, expires: 0 },
  },
  { timestamps: true }
);
delivery.index({ requestId: 1 });
export const PushDelivery = model("IntegrationPushDelivery", delivery);

const event = new Schema(
  {
    _id: String,
    connectionId: Schema.Types.ObjectId,
    connectionGeneration: String,
    source: String,
    payload: Schema.Types.Mixed,
    state: { type: String, default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, expires: 0 },
  },
  { timestamps: true }
);
event.index({ state: 1, nextAttemptAt: 1, createdAt: 1, _id: 1 });
export const PushEvent = model("IntegrationPushEvent", event);
