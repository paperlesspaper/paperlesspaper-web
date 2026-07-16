import mongoose, { type Model, type Schema } from "mongoose";

export type DeviceUploadLogStatus =
  | "started"
  | "skipped"
  | "uploaded"
  | "partial"
  | "failed";

export type DeviceUploadLog = {
  attemptId: string;
  deviceName: string;
  deviceId?: string;
  paperId?: string;
  uploadId?: string;
  uuid?: string;
  trigger: string;
  triggerMetadata?: Record<string, unknown>;
  forceUpload: boolean;
  status: DeviceUploadLogStatus;
  reason: string;
  decision?: Record<string, unknown>;
  similarityPercentage?: number | null;
  similarityThreshold?: number | null;
  buffers?: Record<string, unknown>;
  stages?: Record<string, unknown>;
  iotResponse?: unknown;
  failures?: Array<Record<string, unknown>>;
  startedAt: Date;
  finishedAt?: Date | null;
  durationMs?: number | null;
};

const devicesLogsSchema: Schema<DeviceUploadLog> = new mongoose.Schema(
  {
    attemptId: { type: String, required: true },
    deviceName: { type: String, required: true },
    deviceId: { type: String },
    paperId: { type: String },
    uploadId: { type: String },
    uuid: { type: String },
    trigger: { type: String, required: true, default: "unknown" },
    triggerMetadata: { type: mongoose.Schema.Types.Mixed },
    forceUpload: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: ["started", "skipped", "uploaded", "partial", "failed"],
      default: "started",
    },
    reason: { type: String, required: true, default: "attempt-started" },
    decision: { type: mongoose.Schema.Types.Mixed },
    similarityPercentage: { type: Number, default: null },
    similarityThreshold: { type: Number, default: null },
    buffers: { type: mongoose.Schema.Types.Mixed },
    stages: { type: mongoose.Schema.Types.Mixed },
    iotResponse: { type: mongoose.Schema.Types.Mixed },
    failures: { type: [mongoose.Schema.Types.Mixed], default: [] },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
  },
  {
    bufferCommands: false,
    collection: "devicesLogs",
    minimize: false,
    timestamps: true,
  },
);

devicesLogsSchema.index({ attemptId: 1 }, { unique: true });
devicesLogsSchema.index({ deviceName: 1, startedAt: -1 });
devicesLogsSchema.index({ deviceId: 1, startedAt: -1 });
devicesLogsSchema.index({ paperId: 1, startedAt: -1 });
devicesLogsSchema.index({ status: 1, startedAt: -1 });

const DevicesLogs: Model<DeviceUploadLog> =
  (mongoose.models.DevicesLogs as Model<DeviceUploadLog> | undefined) ||
  mongoose.model<DeviceUploadLog>(
    "DevicesLogs",
    devicesLogsSchema,
    "devicesLogs",
  );

export default DevicesLogs;
