import {
  prepareImageUrlForEditor,
  type PreparedEditorImageSource,
} from "./imageDataUrl";

export const EDITOR_IMAGE_SOURCE_PROPS = [
  "memoImagePreviewUrl",
  "memoImageFullUrl",
  "memoImagePreviewWidth",
  "memoImagePreviewHeight",
  "memoImageFullWidth",
  "memoImageFullHeight",
  "memoImageCrossOrigin",
] as const;

type EditorImageSourceProp = (typeof EDITOR_IMAGE_SOURCE_PROPS)[number];

type FabricImageLike = {
  [key in EditorImageSourceProp]?: unknown;
} & {
  getSrc?: () => string;
  getScaledWidth?: () => number;
  getScaledHeight?: () => number;
  set?: (values: Record<string, unknown> | string, value?: unknown) => unknown;
  setCoords?: () => void;
  setSrc?: (
    src: string,
    options?: { crossOrigin?: "anonymous" | "" | null },
  ) => Promise<void>;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
};

const isStringSource = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const isTransientImageSource = (value: unknown): value is string =>
  typeof value === "string" && /^(blob|data):/i.test(value);

export const getFabricImageSrc = (image: FabricImageLike) => {
  if (typeof image.getSrc === "function") return image.getSrc();
  return "";
};

const getImageDisplaySize = (image: FabricImageLike) => ({
  width:
    typeof image.getScaledWidth === "function"
      ? image.getScaledWidth()
      : (image.width || 1) * (image.scaleX || 1),
  height:
    typeof image.getScaledHeight === "function"
      ? image.getScaledHeight()
      : (image.height || 1) * (image.scaleY || 1),
});

const setFabricImageSrcPreservingDisplaySize = async (
  image: FabricImageLike,
  src: string,
  crossOrigin?: "anonymous" | "" | null,
) => {
  if (typeof image.setSrc !== "function") return false;

  const displaySize = getImageDisplaySize(image);
  await image.setSrc(src, { crossOrigin });

  const imageWidth = image.width || displaySize.width || 1;
  const imageHeight = image.height || displaySize.height || 1;
  image.scaleX = displaySize.width / imageWidth;
  image.scaleY = displaySize.height / imageHeight;
  image.setCoords?.();

  return true;
};

export const setEditorImageSourceMetadata = (
  image: FabricImageLike,
  source: PreparedEditorImageSource,
  crossOrigin?: "anonymous" | "" | null,
) => {
  image.set?.({
    memoImagePreviewUrl: source.previewUrl,
    memoImageFullUrl: source.fullUrl,
    memoImagePreviewWidth: source.previewWidth,
    memoImagePreviewHeight: source.previewHeight,
    memoImageFullWidth: source.fullWidth,
    memoImageFullHeight: source.fullHeight,
    memoImageCrossOrigin: crossOrigin,
  });
};

export const prepareFabricImageForEditorPreview = async (
  image: FabricImageLike,
  {
    crossOrigin,
    maxSize,
  }: {
    crossOrigin?: "anonymous" | "" | null;
    maxSize?: number;
  } = {},
) => {
  const existingPreviewUrl = image.memoImagePreviewUrl;
  if (isStringSource(existingPreviewUrl)) {
    await setFabricImageSrcPreservingDisplaySize(
      image,
      existingPreviewUrl,
      crossOrigin,
    );
    return true;
  }

  const fullUrl = isStringSource(image.memoImageFullUrl)
    ? image.memoImageFullUrl
    : getFabricImageSrc(image);
  if (!fullUrl) return false;

  const source = await prepareImageUrlForEditor({
    imageUrl: fullUrl,
    maxSize,
    crossOrigin,
  });

  setEditorImageSourceMetadata(image, source, crossOrigin);

  if (source.previewUrl === getFabricImageSrc(image)) {
    return true;
  }

  await setFabricImageSrcPreservingDisplaySize(
    image,
    source.previewUrl,
    crossOrigin,
  );
  return true;
};
