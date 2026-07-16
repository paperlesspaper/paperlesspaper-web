import axios from "axios";
import { AuthenticationClient } from "auth0";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import sharp, { type ResizeOptions } from "sharp";
import {
  SIMILARITY_THRESHOLD,
  compareImages,
  getSignedFileUrl,
} from "@internetderdinge/api";

type UploadSingleImageParams = {
  deviceName: string;
  buffer: Buffer;
  bufferOriginal?: Buffer;
  bufferEditable?: Buffer;
  id?: string;
  deviceId?: string;
  uuid?: string;
  forceUpload?: boolean;
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
) => {
  return { key: data?.Key, similarityPercentage, skippedUpload };
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

export const downloadPreviousDeviceImage = async (
  deviceName: string,
): Promise<Buffer | null> => {
  if (!deviceName) {
    return null;
  }

  try {
    const signedUrl = await getSignedFileUrl({
      fileName: getDeviceImageKey(deviceName),
    });
    const response = await axios.get<ArrayBuffer>(signedUrl, {
      responseType: "arraybuffer",
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    console.warn(
      `Unable to download previous device image for ${deviceName}:`,
      error?.message || error,
    );
    return null;
  }
};

export const evaluateDeviceSimilarityBeforeUpload = async (
  deviceName: string,
  buffer: Buffer,
): Promise<{ similarityPercentage: number | null; skipUpload: boolean }> => {
  const previousBuffer = await downloadPreviousDeviceImage(deviceName);
  if (!previousBuffer) {
    return { similarityPercentage: null, skipUpload: false };
  }

  try {
    const similarityPercentage = await compareImages(previousBuffer, buffer);
    return {
      similarityPercentage,
      skipUpload: similarityPercentage >= SIMILARITY_THRESHOLD,
    };
  } catch (error: any) {
    console.warn(
      `Device image similarity comparison failed for ${deviceName}:`,
      error?.message || error,
    );
    return { similarityPercentage: null, skipUpload: false };
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
}: UploadSingleImageParams): Promise<any> => {
  try {
    const resolvedId = resolveUploadId({ id, deviceId, uuid });
    const originalBuffer = bufferOriginal || buffer;

    // Paper-level similarity is intentionally disabled. The image displayed by
    // the physical frame is device-specific and may come from another paper.
    // const paperSimilarity = await evaluateSimilarityBeforeUpload(
    //   resolvedId,
    //   originalBuffer,
    //   storedOriginalBuffer,
    // );
    const { skipUpload, similarityPercentage } = forceUpload
      ? { skipUpload: false, similarityPercentage: null }
      : await evaluateDeviceSimilarityBeforeUpload(deviceName, buffer);
    let response: any = {};

    if (skipUpload) {
      return buildUploadResponse(
        { message: "Image skipped due to similarity threshold" },
        similarityPercentage,
        true,
      );
    }

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

    try {
      const accessToken = await getAuth0Token();

      response = await axios.post(
        `${process.env.IOT_API_URL_EPAPER}uploads`,
        { deviceName },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (response?.data?.uploadURL) {
        await axios.put(response.data.uploadURL, buffer, {
          headers: { "Content-Type": "text/octet-stream" },
        });

        try {
          await uploadImage({
            blob: buffer,
            key: getDeviceImageKey(deviceName),
            contentType: "image/png",
          });
        } catch (deviceImageUploadError) {
          console.error("Failed to store the device-specific frame image:", {
            deviceName,
            message:
              deviceImageUploadError instanceof Error
                ? deviceImageUploadError.message
                : String(deviceImageUploadError),
          });
        }
      }
    } catch (iotUploadError) {
      console.error("IoT upload failed after storing preview images:", {
        deviceName,
        id: resolvedId,
        message:
          iotUploadError instanceof Error
            ? iotUploadError.message
            : String(iotUploadError),
      });
    }

    return buildUploadResponse(
      response?.data || {},
      similarityPercentage,
      false,
    );
  } catch (error) {
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
