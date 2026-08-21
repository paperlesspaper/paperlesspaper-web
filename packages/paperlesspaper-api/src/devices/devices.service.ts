import {
  ApiError,
  Device,
  getSignedFileUrl,
  iotDevicesService,
} from "@internetderdinge/api";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, timingSafeEqual } from "node:crypto";
import httpStatus from "http-status";
import mongoose, { type ClientSession } from "mongoose";
import iotdeviceService from "../iotdevice/iotdevice.service";
import Paper from "../papers/papers.model.js";
import type { PuppeteerRenderDiagnostics } from "../render/render.service";

type DeviceDeactivationPreview = {
  device: {
    id: string;
    deviceId: string;
    kind: string | null;
    organizationId: string | null;
  };
  papersToDetach: {
    count: number;
    ids: string[];
  };
  iotDeviceWillBeDeactivated: true;
  confirmationToken: string;
};

type DeviceDeactivationResult = {
  preview: DeviceDeactivationPreview;
  deleted: {
    devices: number;
  };
  updated: {
    papers: number;
  };
  iotDeviceDeactivated: true;
};

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const isMissingS3ObjectError = (error: any): boolean => {
  return (
    error?.name === "NoSuchKey" ||
    error?.name === "NotFound" ||
    error?.Code === "NoSuchKey" ||
    error?.$metadata?.httpStatusCode === 404
  );
};

const objectExists = async (key: string): Promise<boolean> => {
  const headCommand = new HeadObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });

  try {
    await s3.send(headCommand);
    return true;
  } catch (error) {
    if (isMissingS3ObjectError(error)) {
      return false;
    }

    throw error;
  }
};

const getImageFileNameCandidates = (
  deviceId: string,
  uuid: string,
): string[] => {
  const base = `ePaperImages/${deviceId}+${uuid}`;

  if (uuid.endsWith("-original") || uuid === "original") {
    return [`${base}.png`, `${base}.jpg`];
  }

  if (uuid.endsWith("-thumbnail")) {
    const originalBase = base.replace(/-thumbnail$/, "-original");
    return [`${base}.jpg`, `${originalBase}.jpg`, `${originalBase}.png`];
  }

  return [`${base}.png`];
};

const resolveImageFileName = async (
  deviceId: string,
  uuid: string,
): Promise<string> => {
  const candidates = getImageFileNameCandidates(deviceId, uuid);
  if (candidates.length === 1) return candidates[0];

  for (const candidate of candidates) {
    if (await objectExists(candidate)) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
};

const getImageById = async (
  deviceId: string,
  uuid: string,
): Promise<{ url: string }> => {
  const fileName = await resolveImageFileName(deviceId, uuid);
  const url = await getSignedFileUrl({ fileName });
  return { url };
};

const updateSingleImageMeta = async (
  deviceId: string,
  shadowNew: any,
): Promise<any> => {
  const shadowBody = {
    state: {
      reported: shadowNew,
    },
  };

  return iotDevicesService.shadowAlarmUpdate(deviceId, shadowBody, "settings");
};

const uploadSingleImage = async ({
  deviceName,
  buffer,
  deviceId,
  uuid,
  trigger,
  render,
}: {
  deviceName: string;
  buffer: Buffer;
  deviceId: string;
  uuid: string;
  trigger?: string;
  render?: PuppeteerRenderDiagnostics;
}): Promise<any> => {
  return iotdeviceService.uploadSingleImage({
    deviceName,
    buffer,
    deviceId,
    uuid,
    trigger,
    render,
  });
};

const applySession = <T extends { session: (session: ClientSession) => T }>(
  query: T,
  session?: ClientSession,
): T => (session ? query.session(session) : query);

const getDeviceDeactivationPreview = async (
  deviceId: string,
  session?: ClientSession,
): Promise<DeviceDeactivationPreview> => {
  const device = await applySession(Device.findOne({ deviceId }), session);
  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
  }

  const deviceObjectId = device._id.toString();
  const relatedPapers = await applySession(
    Paper.find({ deviceId: device._id }).select("_id").lean(),
    session,
  );
  const paperIds = relatedPapers
    .map((paper: any) => paper._id.toString())
    .sort();

  const tokenPayload = {
    deviceId,
    deviceObjectId,
    deviceUpdatedAt:
      device.updatedAt instanceof Date ? device.updatedAt.toISOString() : null,
    paperIds,
  };
  const confirmationToken = createHash("sha256")
    .update(JSON.stringify(tokenPayload))
    .digest("hex");

  return {
    device: {
      id: deviceObjectId,
      deviceId,
      kind: device.kind || null,
      organizationId: device.organization?.toString() || null,
    },
    papersToDetach: {
      count: paperIds.length,
      ids: paperIds,
    },
    iotDeviceWillBeDeactivated: true,
    confirmationToken,
  };
};

const confirmationTokensMatch = (
  expected: string | undefined,
  actual: string,
): boolean => {
  if (!expected || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
};

const assertCurrentPreview = (
  preview: DeviceDeactivationPreview,
  confirmationToken: string | undefined,
): void => {
  if (!confirmationTokensMatch(confirmationToken, preview.confirmationToken)) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Dry run is missing or stale. Run the deactivation dry run again.",
    );
  }
};

const isUnsupportedTransactionError = (error: any): boolean =>
  error?.code === 20 ||
  /transaction numbers are only allowed|does not support transactions/i.test(
    error?.message || "",
  );

const previewWithTransactionCheck = async (
  deviceId: string,
  confirmationToken: string | undefined,
): Promise<DeviceDeactivationPreview> => {
  const session = await mongoose.startSession();
  let preview: DeviceDeactivationPreview | undefined;

  try {
    await session.withTransaction(async () => {
      preview = await getDeviceDeactivationPreview(deviceId, session);
      assertCurrentPreview(preview, confirmationToken);
    });
  } catch (error) {
    if (
      process.env.NODE_ENV !== "production" &&
      isUnsupportedTransactionError(error)
    ) {
      preview = await getDeviceDeactivationPreview(deviceId);
      assertCurrentPreview(preview, confirmationToken);
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  return preview!;
};

const deleteDeviceAndDetachPapers = async ({
  deviceId,
  confirmationToken,
  session,
}: {
  deviceId: string;
  confirmationToken: string;
  session?: ClientSession;
}): Promise<Pick<DeviceDeactivationResult, "deleted" | "updated">> => {
  const preview = await getDeviceDeactivationPreview(deviceId, session);
  assertCurrentPreview(preview, confirmationToken);

  const writeOptions = session ? { session } : {};

  const paperResult = await Paper.updateMany(
    { deviceId: preview.device.id },
    { $unset: { deviceId: 1 } },
    writeOptions,
  );
  const deviceResult = await Device.deleteOne(
    { _id: preview.device.id, deviceId },
    writeOptions,
  );

  if (deviceResult.deletedCount !== 1) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Device changed while it was being deactivated",
    );
  }

  return {
    deleted: {
      devices: deviceResult.deletedCount,
    },
    updated: {
      papers: paperResult.modifiedCount,
    },
  };
};

const deleteDeviceAndDetachPapersAtomically = async ({
  deviceId,
  confirmationToken,
}: {
  deviceId: string;
  confirmationToken: string;
}): Promise<Pick<DeviceDeactivationResult, "deleted" | "updated">> => {
  const session = await mongoose.startSession();
  let changes:
    | Pick<DeviceDeactivationResult, "deleted" | "updated">
    | undefined;

  try {
    await session.withTransaction(async () => {
      changes = await deleteDeviceAndDetachPapers({
        deviceId,
        confirmationToken,
        session,
      });
    });
  } catch (error) {
    if (
      process.env.NODE_ENV !== "production" &&
      isUnsupportedTransactionError(error)
    ) {
      return deleteDeviceAndDetachPapers({
        deviceId,
        confirmationToken,
      });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return changes!;
};

const deactivateDeviceByDeviceId = async ({
  deviceId,
  confirmationToken,
}: {
  deviceId: string;
  confirmationToken?: string;
}): Promise<DeviceDeactivationResult> => {
  const preview = await previewWithTransactionCheck(
    deviceId,
    confirmationToken,
  );

  const iotResult = await iotDevicesService.activateDevice(
    preview.device.deviceId,
    preview.device.organizationId,
    false,
    true,
  );
  if (!iotResult) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Epaper device could not be deactivated",
    );
  }

  const changes = await deleteDeviceAndDetachPapersAtomically({
    deviceId,
    confirmationToken: preview.confirmationToken,
  });

  return {
    preview,
    ...changes,
    iotDeviceDeactivated: true,
  };
};

export default {
  deactivateDeviceByDeviceId,
  getDeviceDeactivationPreview,
  getImageById,
  updateSingleImageMeta,
  uploadSingleImage,
};
