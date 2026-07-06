export type PreparedEditorImageSource = {
  previewUrl: string;
  fullUrl: string;
  previewWidth?: number;
  previewHeight?: number;
  fullWidth?: number;
  fullHeight?: number;
};

export const EDITOR_IMAGE_PREVIEW_MAX_SIZE = 1280;

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error(`Failed to read image file: ${file.name}`));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Unexpected image data for file: ${file.name}`));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });

const getNormalizedImageMimeType = (
  mimeType?: string,
  imageUrl?: string,
): string => {
  const normalizedMimeType = mimeType?.toLowerCase();
  const normalizedImageUrl = imageUrl?.toLowerCase();

  if (
    normalizedMimeType === "image/jpeg" ||
    normalizedMimeType === "image/jpg"
  ) {
    return "image/jpeg";
  }

  if (normalizedMimeType === "image/png") {
    return "image/png";
  }

  if (
    normalizedImageUrl?.startsWith("data:image/jpeg") ||
    normalizedImageUrl?.startsWith("data:image/jpg") ||
    /\.(jpe?g)(?:[?#].*)?$/.test(normalizedImageUrl || "")
  ) {
    return "image/jpeg";
  }

  return "image/png";
};

const loadImageElement = (
  imageUrl: string,
  crossOrigin?: "anonymous" | "" | null,
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin !== undefined && crossOrigin !== null) {
      image.crossOrigin = crossOrigin;
    }

    image.src = imageUrl;

    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => reject(new Error("Image could not be loaded."));
  });

export const prepareImageUrlForEditor = async ({
  imageUrl,
  maxSize = EDITOR_IMAGE_PREVIEW_MAX_SIZE,
  mimeType,
  crossOrigin,
}: {
  imageUrl: string;
  maxSize?: number;
  mimeType?: string;
  crossOrigin?: "anonymous" | "" | null;
}): Promise<PreparedEditorImageSource> => {
  const image = await loadImageElement(imageUrl, crossOrigin);
  const fullWidth = image.naturalWidth || image.width;
  const fullHeight = image.naturalHeight || image.height;

  const result: PreparedEditorImageSource = {
    previewUrl: imageUrl,
    fullUrl: imageUrl,
    previewWidth: fullWidth,
    previewHeight: fullHeight,
    fullWidth,
    fullHeight,
  };

  if (Math.max(fullWidth, fullHeight) <= maxSize) {
    return result;
  }

  const canvas = document.createElement("canvas");
  if (fullHeight >= fullWidth) {
    canvas.height = maxSize;
    canvas.width = Math.round((maxSize / fullHeight) * fullWidth);
  } else {
    canvas.width = maxSize;
    canvas.height = Math.round((maxSize / fullWidth) * fullHeight);
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return result;
  }

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      ...result,
      previewUrl: canvas.toDataURL(
        getNormalizedImageMimeType(mimeType, imageUrl),
      ),
      previewWidth: canvas.width,
      previewHeight: canvas.height,
    };
  } catch (error) {
    console.warn("Could not create editor preview image", error);
    return result;
  }
};

export const resizeImageDataUrl = async (
  maxSize: number,
  imageUrl: string,
  mimeType?: string,
): Promise<string> =>
  (
    await prepareImageUrlForEditor({
      imageUrl,
      maxSize,
      mimeType,
    })
  ).previewUrl;

export const prepareImageFileSourcesForEditor = async (
  file: File,
  maxSize = EDITOR_IMAGE_PREVIEW_MAX_SIZE,
): Promise<PreparedEditorImageSource> => {
  const dataUrl = await readFileAsDataUrl(file);
  return prepareImageUrlForEditor({
    imageUrl: dataUrl,
    maxSize,
    mimeType: file.type || "image/png",
  });
};

export const prepareImageFileForEditor = async (
  file: File,
  maxSize = EDITOR_IMAGE_PREVIEW_MAX_SIZE,
): Promise<string> => {
  return (await prepareImageFileSourcesForEditor(file, maxSize)).previewUrl;
};
