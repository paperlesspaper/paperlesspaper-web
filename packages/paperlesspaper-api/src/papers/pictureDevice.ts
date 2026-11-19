import sharp from "sharp";
import { ApiError } from "@internetderdinge/api";
import { deviceByKind } from "@paperlesspaper/helpers";

export const PICTURE_DEVICE_MAX_BYTES = 10 * 1024 * 1024;

/** Validate without changing the bytes that will be sent to the panel. */
export const validatePictureDevice = async (
  buffer: Buffer,
  kind: string
): Promise<void> => {
  if (buffer.length > PICTURE_DEVICE_MAX_BYTES) {
    throw new ApiError(413, "pictureDevice must not exceed 10 MiB.");
  }
  const resolution = deviceByKind(kind)?.resolution;
  if (!resolution?.width || !resolution?.height) {
    throw new ApiError(
      400,
      "pictureDevice requires a device with a known panel resolution."
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ApiError(
      400,
      "pictureDevice must be a readable PNG or JPEG image."
    );
  }
  if (metadata.format !== "png" && metadata.format !== "jpeg") {
    throw new ApiError(400, "pictureDevice supports PNG and JPEG only.");
  }
  if (
    metadata.width !== resolution.width ||
    metadata.height !== resolution.height
  ) {
    throw new ApiError(
      400,
      `pictureDevice must be ${resolution.width}x${resolution.height} pixels for ${kind}, in native panel orientation.`
    );
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new ApiError(400, "pictureDevice must contain a single still image.");
  }
  if (metadata.orientation && metadata.orientation !== 1) {
    throw new ApiError(
      400,
      "pictureDevice must have its rotation applied to the pixels, without EXIF orientation."
    );
  }
  try {
    // Reading the header alone also accepts truncated or corrupt image data.
    await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: resolution.width * resolution.height,
    })
      .raw()
      .toBuffer();
  } catch {
    throw new ApiError(
      400,
      "pictureDevice contains invalid or incomplete image data."
    );
  }
};
