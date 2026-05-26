import { Capacitor } from "@capacitor/core";
import type {
  ShareReceivedEvent,
  SharedFile,
} from "@capgo/capacitor-share-target";

const SHARE_TARGET_STORAGE_PREFIX = "paperlesspaper-share-target:";

export type StoredShareTargetImage = {
  uri: string;
  name: string;
  mimeType: string;
};

export type StoredShareTargetPayload = {
  id: string;
  images: StoredShareTargetImage[];
  title?: string;
  texts?: string[];
  createdAt: number;
};

const isImageSharedFile = (file: SharedFile) =>
  Boolean(file?.uri) && file.mimeType?.toLowerCase().startsWith("image/");

export const storeShareTargetPayload = (
  event: ShareReceivedEvent,
): StoredShareTargetPayload | null => {
  const images = (event.files || []).filter(isImageSharedFile).map((file) => ({
    uri: file.uri,
    name: file.name || "shared-image",
    mimeType: file.mimeType || "image/png",
  }));

  if (images.length === 0) return null;

  const payload = {
    id: crypto.randomUUID(),
    images,
    title: event.title,
    texts: event.texts,
    createdAt: Date.now(),
  };

  sessionStorage.setItem(
    `${SHARE_TARGET_STORAGE_PREFIX}${payload.id}`,
    JSON.stringify(payload),
  );

  return payload;
};

export const getShareTargetPayload = (
  id?: string | string[] | null,
): StoredShareTargetPayload | null => {
  const shareTargetId = Array.isArray(id) ? id[0] : id;
  if (!shareTargetId) return null;

  const rawPayload = sessionStorage.getItem(
    `${SHARE_TARGET_STORAGE_PREFIX}${shareTargetId}`,
  );
  if (!rawPayload) return null;

  try {
    return JSON.parse(rawPayload);
  } catch (error) {
    console.error("Failed to parse shared image payload", error);
    return null;
  }
};

export const getShareTargetImageUrl = (image: StoredShareTargetImage) => {
  if (
    image.uri.startsWith("data:") ||
    image.uri.startsWith("blob:") ||
    image.uri.startsWith("http://") ||
    image.uri.startsWith("https://")
  ) {
    return image.uri;
  }

  return Capacitor.convertFileSrc(image.uri);
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Failed to read shared image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unexpected shared image data."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(blob);
  });

export const getShareTargetImageDataUrl = async (
  image: StoredShareTargetImage,
) => {
  const imageUrl = getShareTargetImageUrl(image);

  if (imageUrl.startsWith("data:")) return imageUrl;

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    return readBlobAsDataUrl(blob);
  } catch (error) {
    console.error("Failed to load shared image as data URL", error);
    return imageUrl;
  }
};
