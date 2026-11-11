import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ApiError, getSignedFileUrl } from "@internetderdinge/api";
import { PushContent, PushRequest } from "./models.js";
import { integrationIdentity } from "./access.js";
import { hash } from "./security.js";
const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export async function acceptContent(
  connection: any,
  input: { messageId: string; text?: string; imageBase64?: string }
) {
  if (!connection.generation)
    throw new ApiError(401, "Connection must be reconnected");
  const bytes = input.imageBase64
    ? Buffer.from(input.imageBase64, "base64")
    : undefined;
  if (
    bytes &&
    (bytes.length > MAX_IMAGE_BYTES ||
      bytes.toString("base64") !== input.imageBase64)
  )
    throw new ApiError(400, "Invalid image (maximum 20 MB)");
  if (!input.text?.trim() && !bytes?.length)
    throw new ApiError(400, "Text or image required");
  const fingerprint = hash(
    JSON.stringify([input.text || "", input.imageBase64 || ""])
  );
  const id = hash(
    `${connection._id}:${connection.generation}:${input.messageId}`
  );
  let request = await PushRequest.findById(id);
  if (request && request.fingerprint !== fingerprint)
    throw new ApiError(409, "Message ID already used for different content");
  if (request && request.state !== "receiving") return request;
  let image: Buffer | undefined;
  if (bytes) {
    try {
      const decoder = sharp(bytes, {
        limitInputPixels: 40_000_000,
        animated: false,
      });
      if (
        !["jpeg", "png", "webp"].includes(
          (await decoder.metadata()).format || ""
        )
      )
        throw new Error();
      image = await decoder
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
    } catch {
      throw new ApiError(
        400,
        "Supported images: JPEG, PNG, WebP, maximum 40 MP"
      );
    }
  }
  request ??= await PushRequest.findOneAndUpdate(
    { _id: id },
    {
      $setOnInsert: {
        connectionId: connection._id,
        connectionGeneration: connection.generation,
        paperId: connection.paperId,
        source: connection.source,
        messageId: input.messageId,
        fingerprint,
        text: input.text || "",
        state: "receiving",
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      },
    },
    { upsert: true, new: true }
  );
  if (request.fingerprint !== fingerprint)
    throw new ApiError(409, "Message ID already used");
  if (request.state !== "receiving") return request;
  const imageKey = image
    ? `integration-push/${connection.paperId}/${id}.png`
    : undefined;
  if (image)
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: imageKey,
        Body: image,
        ContentType: "image/png",
      })
    );
  return (
    (await PushRequest.findOneAndUpdate(
      { _id: id, state: "receiving" },
      { $set: { imageKey, state: "accepted", nextCheckAt: new Date() } },
      { new: true }
    )) || (await PushRequest.findById(id))
  );
}

export async function getIntegrationRenderContent(paper: any) {
  let source: string;
  try {
    source = integrationIdentity(paper).source;
  } catch {
    return undefined;
  }
  const content = await PushContent.findById(paper._id || paper.id);
  if (!content || content.source !== source) return undefined;
  return {
    revision: content.revision,
    text: content.text || "",
    receivedAt: content.receivedAt,
    imageUrl: content.imageKey
      ? await getSignedFileUrl({ fileName: content.imageKey })
      : undefined,
  };
}
