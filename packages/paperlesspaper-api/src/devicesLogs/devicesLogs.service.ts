import DevicesLogs, { type DeviceUploadLog } from "./devicesLogs.model.js";

const MAX_STRING_LENGTH = 4_000;
const MAX_SANITIZE_DEPTH = 5;
const SENSITIVE_KEY_PATTERN =
  /authorization|password|secret|token|uploadurl|presignedurl/i;

export const serializeDeviceLogError = (
  error: unknown,
): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const errorWithResponse = error as Error & {
    code?: string;
    status?: number;
    response?: { status?: number };
    $metadata?: { httpStatusCode?: number };
  };

  return {
    name: error.name,
    message: error.message,
    code: errorWithResponse.code,
    httpStatus:
      errorWithResponse.response?.status ||
      errorWithResponse.status ||
      errorWithResponse.$metadata?.httpStatusCode,
    stack: error.stack?.slice(0, 8_000),
  };
};

export const sanitizeDeviceLogValue = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_SANITIZE_DEPTH) return "[maximum-depth]";
  if (Buffer.isBuffer(value)) return `[buffer:${value.length} bytes]`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDeviceLogValue(entry, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeDeviceLogValue(entry, depth + 1),
    ]),
  );
};

export const saveDeviceUploadLog = async (
  log: DeviceUploadLog,
): Promise<boolean> => {
  try {
    await DevicesLogs.updateOne(
      { attemptId: log.attemptId },
      { $set: log },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return true;
  } catch (error) {
    console.error("Failed to persist device upload log", {
      attemptId: log.attemptId,
      deviceName: log.deviceName,
      error: serializeDeviceLogError(error),
    });
    return false;
  }
};

export const getDeviceUploadLogs = async ({
  deviceId,
  deviceName,
  limit = 50,
}: {
  deviceId: string;
  deviceName: string;
  limit?: number;
}) => {
  const normalizedLimit = Math.min(Math.max(Math.floor(limit), 1), 100);

  return DevicesLogs.find({
    $or: [{ deviceId }, { deviceName }],
  })
    .sort({ startedAt: -1 })
    .limit(normalizedLimit)
    .lean()
    .exec();
};

export default {
  getDeviceUploadLogs,
  sanitizeDeviceLogValue,
  saveDeviceUploadLog,
  serializeDeviceLogError,
};
