import { getSignedFileUrl, iotDevicesService } from "@internetderdinge/api";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import iotdeviceService from "../iotdevice/iotdevice.service";
import type { PuppeteerRenderDiagnostics } from "../render/render.service";

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

export default {
  getImageById,
  updateSingleImageMeta,
  uploadSingleImage,
};
