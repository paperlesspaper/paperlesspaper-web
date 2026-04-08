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
    imageUrl?.startsWith("data:image/jpeg") ||
    imageUrl?.startsWith("data:image/jpg")
  ) {
    return "image/jpeg";
  }

  return "image/png";
};

export const resizeImageDataUrl = (
  maxSize: number,
  imageUrl: string,
  mimeType?: string,
): Promise<string> => {
  return new Promise((resolve) => {
    const image = new Image();
    const outputMimeType = getNormalizedImageMimeType(mimeType, imageUrl);
    image.src = imageUrl;
    image.onload = () => {
      if (Math.max(image.width, image.height) <= maxSize) {
        resolve(imageUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      if (image.height >= image.width) {
        canvas.height = maxSize;
        canvas.width = (maxSize / image.height) * image.width;
      } else {
        canvas.width = maxSize;
        canvas.height = (maxSize / image.width) * image.height;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(imageUrl);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(outputMimeType));
    };
    image.onerror = () => resolve(imageUrl);
  });
};

export const prepareImageFileForEditor = async (
  file: File,
  maxSize = 2048,
): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);
  return resizeImageDataUrl(maxSize, dataUrl, file.type || "image/png");
};
