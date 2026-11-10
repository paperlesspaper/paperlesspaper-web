import { deleteStoredObject } from "../storage/storage.service.js";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const DEVICE_IMAGE_PREFIX = "ePaperDeviceImages";

export const getDeviceImageKey = (deviceName: string): string =>
  `${DEVICE_IMAGE_PREFIX}/${encodeURIComponent(deviceName)}.png`;

// Only the device's comparison image is removed. Paper originals and previews
// belong to their papers and must survive a change of device ownership.
export async function resetDeviceImageCache(deviceName: string): Promise<void> {
  const s3 = new S3Client({
    region: "eu-central-1",
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 10_000, socketTimeout: 30_000 },
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  try {
    await deleteStoredObject(getDeviceImageKey(deviceName), () =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: getDeviceImageKey(deviceName),
        })
      )
    );
  } finally {
    s3.destroy();
  }
}
