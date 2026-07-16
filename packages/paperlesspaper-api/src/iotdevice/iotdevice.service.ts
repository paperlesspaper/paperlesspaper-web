import axios from "axios";
import { AuthenticationClient } from "auth0";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";
import sharp, { type ResizeOptions } from "sharp";
import {
  SIMILARITY_THRESHOLD,
  compareImages,
  getSignedFileUrl,
} from "@internetderdinge/api";
import {
  sanitizeDeviceLogValue,
  saveDeviceUploadLog,
  serializeDeviceLogError,
} from "../devicesLogs/devicesLogs.service.js";
import type {
  DeviceUploadLog,
  DeviceUploadLogStatus,
} from "../devicesLogs/devicesLogs.model.js";

type UploadSingleImageParams = {
  deviceName: string;
  buffer: Buffer;
  bufferOriginal?: Buffer;
  bufferEditable?: Buffer;
  id?: string;
  deviceId?: string;
  uuid?: string;
  forceUpload?: boolean;
  trigger?: string;
  triggerMetadata?: Record<string, unknown>;
};

const auth0AuthClient = new AuthenticationClient({
  domain: process.env.AUTH0_MANAGEMENT_DOMAIN!,
  clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID!,
  clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET!,
});

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const ORIGINAL_IMAGE_JPEG_KIND = "original.jpg";
export const ORIGINAL_IMAGE_PNG_KIND = "original.png";
export const THUMBNAIL_IMAGE_JPEG_KIND = "thumbnail.jpg";
export const DEVICE_IMAGE_PREFIX = "ePaperDeviceImages";

const ORIGINAL_IMAGE_JPEG_QUALITY = 95;
const THUMBNAIL_IMAGE_JPEG_QUALITY = 75;
const THUMBNAIL_SHORT_SIDE = 500;

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

const getAuth0Token = async (): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 60) {
    return cachedToken;
  }

  const audience =
    process.env.AUTH0_AUDIENCE ||
    process.env.AUTH0_MANAGEMENT_AUDIENCE ||
    "localhost:3000/";
  const tokenResponse = await auth0AuthClient.oauth.clientCredentialsGrant({
    audience,
  });

  cachedToken = tokenResponse.data.access_token;
  tokenExpiresAt = now + (tokenResponse.data.expires_in || 3600);
  return cachedToken;
};

const uploadImage = async ({
  key,
  blob,
  contentType,
}: {
  key: string;
  blob: Buffer | Uint8Array;
  contentType?: string;
}): Promise<void> => {
  const parallelUploads3 = new Upload({
    client: s3,
    queueSize: 4,
    leavePartsOnError: false,
    params: {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
      Body: blob,
      ...(contentType ? { ContentType: contentType } : {}),
    },
  });

  await parallelUploads3.done();
};

const toJpegBuffer = async (
  buffer: Buffer,
  {
    quality,
    resize,
  }: {
    quality: number;
    resize?: ResizeOptions;
  },
): Promise<Buffer> => {
  let pipeline = sharp(buffer, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" });

  if (resize) {
    pipeline = pipeline.resize(resize);
  }

  return pipeline
    .jpeg({
      quality,
      chromaSubsampling: "4:4:4",
      mozjpeg: true,
    })
    .toBuffer();
};

export const createStoredOriginalImageBuffer = async (
  buffer: Buffer,
): Promise<Buffer> => {
  return toJpegBuffer(buffer, { quality: ORIGINAL_IMAGE_JPEG_QUALITY });
};

const createTemporaryOriginalPngBuffer = async (
  buffer: Buffer,
): Promise<Buffer> => {
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  if (metadata.format === "png") {
    return buffer;
  }

  return sharp(buffer, { failOn: "none" }).rotate().png().toBuffer();
};

const createThumbnailImageBuffer = async (buffer: Buffer): Promise<Buffer> => {
  return toJpegBuffer(buffer, {
    quality: THUMBNAIL_IMAGE_JPEG_QUALITY,
    resize: {
      width: THUMBNAIL_SHORT_SIDE,
      height: THUMBNAIL_SHORT_SIDE,
      fit: "outside",
    },
  });
};

const buildUploadResponse = (
  data: any,
  similarityPercentage: number | null,
  skippedUpload: boolean,
  uploadAttemptId: string,
  reason: string,
) => {
  return {
    key: data?.Key,
    similarityPercentage,
    skippedUpload,
    uploadAttemptId,
    reason,
  };
};

const resolveUploadId = ({
  id,
  deviceId,
  uuid,
}: {
  id?: string;
  deviceId?: string;
  uuid?: string;
}): string => {
  if (id) return id;
  if (deviceId && uuid) return `${deviceId}+${uuid}`;
  if (deviceId) return deviceId;
  throw new Error("Missing upload id (provide id or deviceId)");
};

type PreviousOriginalImage = {
  buffer: Buffer;
  key: string;
};

const getOriginalImageKeys = (id: string): string[] => [
  `ePaperImages/${id}${ORIGINAL_IMAGE_JPEG_KIND}`,
  `ePaperImages/${id}${ORIGINAL_IMAGE_PNG_KIND}`,
];

export const downloadPreviousOriginalImageVariant = async (
  id: string,
): Promise<PreviousOriginalImage | null> => {
  if (!id) {
    return null;
  }

  let lastError: any;

  for (const key of getOriginalImageKeys(id)) {
    try {
      const signedUrl = await getSignedFileUrl({ fileName: key });
      const response = await axios.get<ArrayBuffer>(signedUrl, {
        responseType: "arraybuffer",
      });
      return { buffer: Buffer.from(response.data), key };
    } catch (error: any) {
      lastError = error;
    }
  }

  console.warn(
    `Unable to download previous image for ${id}:`,
    lastError?.message || lastError,
  );
  return null;
};

export const downloadPreviousOriginalImage = async (
  id: string,
): Promise<Buffer | null> => {
  const previousImage = await downloadPreviousOriginalImageVariant(id);
  return previousImage?.buffer || null;
};

export const evaluateSimilarityBeforeUpload = async (
  id: string,
  bufferOriginal?: Buffer,
  storedOriginalBuffer?: Buffer,
): Promise<{ similarityPercentage: number | null; skipUpload: boolean }> => {
  if (!bufferOriginal) {
    return { similarityPercentage: null, skipUpload: false };
  }

  const previousImage = await downloadPreviousOriginalImageVariant(id);
  if (!previousImage) {
    return { similarityPercentage: null, skipUpload: false };
  }

  try {
    const currentComparisonBuffer = previousImage.key.endsWith(
      ORIGINAL_IMAGE_JPEG_KIND,
    )
      ? storedOriginalBuffer ||
        (await createStoredOriginalImageBuffer(bufferOriginal))
      : bufferOriginal;
    const similarityPercentage = await compareImages(
      previousImage.buffer,
      currentComparisonBuffer,
    );
    return {
      similarityPercentage,
      skipUpload: similarityPercentage >= SIMILARITY_THRESHOLD,
    };
  } catch (error: any) {
    console.warn(
      `Similarity comparison failed for ${id}:`,
      error?.message || error,
    );
    return { similarityPercentage: null, skipUpload: false };
  }
};

const getDeviceImageKey = (deviceName: string): string =>
  `${DEVICE_IMAGE_PREFIX}/${encodeURIComponent(deviceName)}.png`;

type PreviousDeviceImageLookup = {
  buffer: Buffer | null;
  key: string;
  status: "found" | "missing" | "error";
  httpStatus?: number;
  error?: Record<string, unknown>;
};

type DeviceSimilarityEvaluation = {
  similarityPercentage: number | null;
  skipUpload: boolean;
  reason:
    | "similarity-threshold-met"
    | "below-similarity-threshold"
    | "previous-device-image-not-found"
    | "previous-device-image-unavailable"
    | "similarity-comparison-failed";
  previousImage: Omit<PreviousDeviceImageLookup, "buffer">;
};

const lookupPreviousDeviceImage = async (
  deviceName: string,
): Promise<PreviousDeviceImageLookup> => {
  const key = getDeviceImageKey(deviceName);
  if (!deviceName) {
    return { buffer: null, key, status: "missing" };
  }

  try {
    const signedUrl = await getSignedFileUrl({ fileName: key });
    const response = await axios.get<ArrayBuffer>(signedUrl, {
      responseType: "arraybuffer",
    });
    return {
      buffer: Buffer.from(response.data),
      key,
      status: "found",
      httpStatus: response.status,
    };
  } catch (error: any) {
    const serializedError = serializeDeviceLogError(error);
    const httpStatus = Number(serializedError.httpStatus) || undefined;
    const status = httpStatus === 404 ? "missing" : "error";
    console.warn(
      `Unable to download previous device image for ${deviceName}:`,
      error?.message || error,
    );
    return {
      buffer: null,
      key,
      status,
      httpStatus,
      error: serializedError,
    };
  }
};

export const downloadPreviousDeviceImage = async (
  deviceName: string,
): Promise<Buffer | null> => {
  const lookup = await lookupPreviousDeviceImage(deviceName);
  return lookup.buffer;
};

export const evaluateDeviceSimilarityBeforeUpload = async (
  deviceName: string,
  buffer: Buffer,
): Promise<DeviceSimilarityEvaluation> => {
  const previousImage = await lookupPreviousDeviceImage(deviceName);
  const { buffer: previousBuffer, ...previousImageDetails } = previousImage;
  if (!previousBuffer) {
    return {
      similarityPercentage: null,
      skipUpload: false,
      reason:
        previousImage.status === "missing"
          ? "previous-device-image-not-found"
          : "previous-device-image-unavailable",
      previousImage: previousImageDetails,
    };
  }

  try {
    const similarityPercentage = await compareImages(previousBuffer, buffer);
    const skipUpload = similarityPercentage >= SIMILARITY_THRESHOLD;
    return {
      similarityPercentage,
      skipUpload,
      reason: skipUpload
        ? "similarity-threshold-met"
        : "below-similarity-threshold",
      previousImage: previousImageDetails,
    };
  } catch (error: any) {
    const serializedError = serializeDeviceLogError(error);
    console.warn(
      `Device image similarity comparison failed for ${deviceName}:`,
      error?.message || error,
    );
    return {
      similarityPercentage: null,
      skipUpload: false,
      reason: "similarity-comparison-failed",
      previousImage: {
        ...previousImageDetails,
        error: serializedError,
      },
    };
  }
};

export const uploadSingleImage = async ({
  deviceName,
  buffer,
  bufferOriginal,
  bufferEditable,
  id,
  deviceId,
  uuid,
  forceUpload = false,
  trigger = "unknown",
  triggerMetadata,
}: UploadSingleImageParams): Promise<any> => {
  const attemptId = randomUUID();
  const startedAt = new Date();
  const uploadLog: DeviceUploadLog = {
    attemptId,
    deviceName: deviceName || "unknown",
    deviceId,
    paperId: id,
    uuid,
    trigger,
    triggerMetadata: sanitizeDeviceLogValue(triggerMetadata) as
      | Record<string, unknown>
      | undefined,
    forceUpload,
    status: "started",
    reason: "attempt-started",
    similarityPercentage: null,
    similarityThreshold: SIMILARITY_THRESHOLD,
    buffers: {
      deviceBytes: buffer?.length ?? null,
      originalBytes: bufferOriginal?.length ?? null,
      editableBytes: bufferEditable?.length ?? null,
    },
    stages: {
      validation: { status: "pending" },
      similarity: { status: "pending" },
      paperImages: { status: "pending" },
      iotUploadRequest: { status: "pending" },
      iotPut: { status: "pending" },
      deviceImageSnapshot: {
        status: "pending",
        key: getDeviceImageKey(deviceName),
      },
    },
    failures: [],
    startedAt,
    finishedAt: null,
    durationMs: null,
  };
  const stages = uploadLog.stages as Record<string, any>;

  const persistUploadLog = async (): Promise<void> => {
    try {
      await saveDeviceUploadLog({
        ...uploadLog,
        decision: uploadLog.decision ? { ...uploadLog.decision } : undefined,
        stages: { ...uploadLog.stages },
        failures: uploadLog.failures?.map((entry) => ({ ...entry })),
      });
    } catch (error) {
      // Logging must never block a physical frame update.
      console.error("Unexpected device upload logging failure", {
        attemptId,
        deviceName,
        error: serializeDeviceLogError(error),
      });
    }
  };

  const addUploadError = (stage: string, error: unknown): void => {
    uploadLog.failures = [
      ...(uploadLog.failures || []),
      {
        stage,
        at: new Date().toISOString(),
        ...serializeDeviceLogError(error),
      },
    ];
  };

  const finalizeUploadLog = async (
    status: DeviceUploadLogStatus,
    reason: string,
  ): Promise<void> => {
    const finishedAt = new Date();
    uploadLog.status = status;
    uploadLog.reason = reason;
    uploadLog.finishedAt = finishedAt;
    uploadLog.durationMs = finishedAt.getTime() - startedAt.getTime();
    await persistUploadLog();
  };

  await persistUploadLog();

  try {
    const resolvedId = resolveUploadId({ id, deviceId, uuid });
    uploadLog.uploadId = resolvedId;
    stages.validation = { status: "completed" };
    const originalBuffer = bufferOriginal || buffer;
    uploadLog.buffers = {
      ...uploadLog.buffers,
      originalBytes: originalBuffer.length,
    };

    // Paper-level similarity is intentionally disabled. The image displayed by
    // the physical frame is device-specific and may come from another paper.
    // const paperSimilarity = await evaluateSimilarityBeforeUpload(
    //   resolvedId,
    //   originalBuffer,
    //   storedOriginalBuffer,
    // );
    const similarityResult = forceUpload
      ? {
          skipUpload: false,
          similarityPercentage: null,
          reason: "force-upload" as const,
          previousImage: {
            key: getDeviceImageKey(deviceName),
            status: "not-checked" as const,
          },
        }
      : await evaluateDeviceSimilarityBeforeUpload(deviceName, buffer);
    const { skipUpload, similarityPercentage } = similarityResult;
    uploadLog.similarityPercentage = similarityPercentage;
    uploadLog.decision = {
      action: skipUpload ? "skip" : "upload",
      reason: similarityResult.reason,
      forceUpload,
    };
    stages.similarity = {
      status: forceUpload
        ? "bypassed"
        : similarityResult.reason === "similarity-comparison-failed"
          ? "failed"
          : "completed",
      similarityPercentage,
      threshold: SIMILARITY_THRESHOLD,
      reason: similarityResult.reason,
      previousImage: similarityResult.previousImage,
    };

    const previousImageError =
      "error" in similarityResult.previousImage
        ? similarityResult.previousImage.error
        : undefined;

    if (
      similarityResult.previousImage.status === "error" ||
      similarityResult.reason === "similarity-comparison-failed"
    ) {
      uploadLog.failures = [
        ...(uploadLog.failures || []),
        {
          stage: "similarity",
          at: new Date().toISOString(),
          ...(previousImageError || {
            message: similarityResult.reason,
          }),
        },
      ];
    }
    let response: any = {};

    if (skipUpload) {
      stages.paperImages = {
        status: "not-run",
        reason: "upload-skipped",
      };
      stages.iotUploadRequest = {
        status: "not-run",
        reason: "upload-skipped",
      };
      stages.iotPut = { status: "not-run", reason: "upload-skipped" };
      stages.deviceImageSnapshot = {
        ...stages.deviceImageSnapshot,
        status: "not-run",
        reason: "upload-skipped",
      };
      await finalizeUploadLog("skipped", similarityResult.reason);
      return buildUploadResponse(
        { message: "Image skipped due to similarity threshold" },
        similarityPercentage,
        true,
        attemptId,
        similarityResult.reason,
      );
    }

    stages.paperImages = { status: "started" };
    const storedOriginalBuffer =
      await createStoredOriginalImageBuffer(originalBuffer);

    const fileName = `ePaperImages/${resolvedId}`;

    await uploadImage({ blob: buffer, key: `${fileName}.png` });
    await uploadImage({
      blob: storedOriginalBuffer,
      key: `${fileName}${ORIGINAL_IMAGE_JPEG_KIND}`,
      contentType: "image/jpeg",
    });
    await uploadImage({
      blob: await createTemporaryOriginalPngBuffer(originalBuffer),
      key: `${fileName}${ORIGINAL_IMAGE_PNG_KIND}`,
      contentType: "image/png",
    });
    await uploadImage({
      blob: await createThumbnailImageBuffer(originalBuffer),
      key: `${fileName}${THUMBNAIL_IMAGE_JPEG_KIND}`,
      contentType: "image/jpeg",
    });

    if (bufferEditable) {
      const editablePayload =
        bufferEditable instanceof Buffer
          ? bufferEditable
          : Buffer.from(JSON.stringify(bufferEditable), "utf8");

      await uploadImage({
        blob: editablePayload,
        key: `${fileName}editable.json`,
      });
    }
    stages.paperImages = {
      status: "completed",
      keys: [
        `${fileName}.png`,
        `${fileName}${ORIGINAL_IMAGE_JPEG_KIND}`,
        `${fileName}${ORIGINAL_IMAGE_PNG_KIND}`,
        `${fileName}${THUMBNAIL_IMAGE_JPEG_KIND}`,
        ...(bufferEditable ? [`${fileName}editable.json`] : []),
      ],
    };

    let finalStatus: DeviceUploadLogStatus = "failed";
    let finalReason = "iot-upload-failed";
    try {
      stages.iotUploadRequest = { status: "started" };
      const accessToken = await getAuth0Token();

      response = await axios.post(
        `${process.env.IOT_API_URL_EPAPER}uploads`,
        { deviceName },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const uploadURL = response?.data?.uploadURL;
      let uploadHost: string | undefined;
      if (uploadURL) {
        try {
          uploadHost = new URL(uploadURL).host;
        } catch {
          uploadHost = undefined;
        }
      }
      stages.iotUploadRequest = {
        status: "completed",
        httpStatus: response?.status,
        hasUploadURL: Boolean(uploadURL),
        uploadHost,
      };
      uploadLog.iotResponse = sanitizeDeviceLogValue(response?.data);

      if (uploadURL) {
        stages.iotPut = { status: "started" };
        const putResponse = await axios.put(uploadURL, buffer, {
          headers: { "Content-Type": "text/octet-stream" },
        });
        stages.iotPut = {
          status: "completed",
          httpStatus: putResponse?.status,
          bytes: buffer.length,
        };
        finalStatus = "uploaded";
        finalReason = "device-frame-uploaded";

        stages.deviceImageSnapshot = {
          status: "started",
          key: getDeviceImageKey(deviceName),
        };
        try {
          await uploadImage({
            blob: buffer,
            key: getDeviceImageKey(deviceName),
            contentType: "image/png",
          });
          stages.deviceImageSnapshot = {
            status: "completed",
            key: getDeviceImageKey(deviceName),
            bytes: buffer.length,
          };
        } catch (deviceImageUploadError) {
          stages.deviceImageSnapshot = {
            status: "failed",
            key: getDeviceImageKey(deviceName),
            error: serializeDeviceLogError(deviceImageUploadError),
          };
          addUploadError("device-image-snapshot", deviceImageUploadError);
          finalStatus = "partial";
          finalReason = "device-frame-uploaded-snapshot-failed";
          console.error("Failed to store the device-specific frame image:", {
            deviceName,
            message:
              deviceImageUploadError instanceof Error
                ? deviceImageUploadError.message
                : String(deviceImageUploadError),
          });
        }
      } else {
        const missingUploadUrlError = new Error(
          "IoT API response did not contain an uploadURL",
        );
        stages.iotUploadRequest = {
          ...stages.iotUploadRequest,
          status: "failed",
          reason: "missing-upload-url",
        };
        stages.iotPut = {
          status: "not-run",
          reason: "missing-upload-url",
        };
        stages.deviceImageSnapshot = {
          ...stages.deviceImageSnapshot,
          status: "not-run",
          reason: "missing-upload-url",
        };
        addUploadError("iot-upload-request", missingUploadUrlError);
        finalReason = "iot-upload-url-missing";
      }
    } catch (iotUploadError) {
      if (stages.iotUploadRequest?.status === "started") {
        stages.iotUploadRequest = {
          status: "failed",
          error: serializeDeviceLogError(iotUploadError),
        };
      } else if (stages.iotPut?.status === "started") {
        stages.iotPut = {
          status: "failed",
          error: serializeDeviceLogError(iotUploadError),
        };
      }
      stages.deviceImageSnapshot = {
        ...stages.deviceImageSnapshot,
        status: "not-run",
        reason: "iot-upload-failed",
      };
      addUploadError("iot-upload", iotUploadError);
      console.error("IoT upload failed after storing preview images:", {
        deviceName,
        id: resolvedId,
        message:
          iotUploadError instanceof Error
            ? iotUploadError.message
            : String(iotUploadError),
      });
    }

    await finalizeUploadLog(finalStatus, finalReason);
    return buildUploadResponse(
      response?.data || {},
      similarityPercentage,
      false,
      attemptId,
      finalReason,
    );
  } catch (error) {
    if (!stages.validation || stages.validation.status === "pending") {
      stages.validation = {
        status: "failed",
        error: serializeDeviceLogError(error),
      };
    }
    if (stages.similarity?.status === "pending") {
      stages.similarity = {
        status: "not-run",
        reason: "upload-processing-failed",
      };
    }
    if (stages.paperImages?.status === "started") {
      stages.paperImages = {
        status: "failed",
        error: serializeDeviceLogError(error),
      };
    }
    for (const stageName of [
      "paperImages",
      "iotUploadRequest",
      "iotPut",
      "deviceImageSnapshot",
    ]) {
      if (stages[stageName]?.status === "pending") {
        stages[stageName] = {
          ...stages[stageName],
          status: "not-run",
          reason: "upload-processing-failed",
        };
      }
    }
    addUploadError("upload-processing", error);
    await finalizeUploadLog("failed", "upload-processing-failed");
    console.error(error);
    return null;
  }
};

export default {
  downloadPreviousOriginalImage,
  downloadPreviousOriginalImageVariant,
  downloadPreviousDeviceImage,
  evaluateDeviceSimilarityBeforeUpload,
  evaluateSimilarityBeforeUpload,
  uploadSingleImage,
};
