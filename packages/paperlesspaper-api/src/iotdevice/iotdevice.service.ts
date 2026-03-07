import axios from "axios";
import { AuthenticationClient } from "auth0";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { fileTypeFromBuffer } from "file-type";
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
}: {
  key: string;
  blob: Buffer | Uint8Array;
}): Promise<void> => {
  const parallelUploads3 = new Upload({
    client: s3,
    queueSize: 4,
    leavePartsOnError: false,
    params: {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
      Body: blob,
    },
  });

  await parallelUploads3.done();
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

export const downloadPreviousOriginalImage = async (
  id: string,
): Promise<Buffer | null> => {
  if (!id) {
    return null;
  }

  try {
    const signedUrl = await getSignedFileUrl({
      fileName: `ePaperImages/${id}original.png`,
    });
    const response = await axios.get<ArrayBuffer>(signedUrl, {
      responseType: "arraybuffer",
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    console.warn(
      `Unable to download previous image for ${id}:`,
      error?.message || error,
    );
    return null;
  }
};

export const evaluateSimilarityBeforeUpload = async (
  id: string,
  bufferOriginal?: Buffer,
): Promise<{ similarityPercentage: number | null; skipUpload: boolean }> => {
  if (!bufferOriginal) {
    return { similarityPercentage: null, skipUpload: false };
  }

  const previousBuffer = await downloadPreviousOriginalImage(id);
  if (!previousBuffer) {
    return { similarityPercentage: null, skipUpload: false };
  }

  try {
    const similarityPercentage = await compareImages(
      previousBuffer,
      bufferOriginal,
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

export const uploadSingleImage = async ({
  deviceName,
  buffer,
  bufferOriginal,
  bufferEditable,
  id,
  deviceId,
  uuid,
}: UploadSingleImageParams): Promise<any> => {
  try {
    const resolvedId = resolveUploadId({ id, deviceId, uuid });
    const originalBuffer = bufferOriginal || buffer;

    const { skipUpload, similarityPercentage } =
      await evaluateSimilarityBeforeUpload(resolvedId, originalBuffer);
    let response: any = {};

    if (skipUpload) {
      return buildUploadResponse(
        { message: "Image skipped due to similarity threshold" },
        similarityPercentage,
        true,
      );
    }

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
    }

    const type = await fileTypeFromBuffer(buffer);
    const fileName = `ePaperImages/${resolvedId}`;

    await uploadImage({ blob: buffer, key: `${fileName}.png` });
    await uploadImage({ blob: originalBuffer, key: `${fileName}original.png` });

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
  evaluateSimilarityBeforeUpload,
  uploadSingleImage,
};
