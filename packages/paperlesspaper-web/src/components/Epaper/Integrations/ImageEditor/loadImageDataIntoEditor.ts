import * as fabric from "fabric";

type LoadImageDataIntoEditorParams = {
  fabricCanvas: any;
  generateImageUrlAlt: (request: any) => Promise<any>;
  paperId: string;
  size: {
    width: number;
    height: number;
  };
};

const EDITOR_LOAD_TIMEOUT_MS = 30_000;
const LEGACY_BLOB_PLACEHOLDER_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const isBlobSrc = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("blob:");

const isBlobSourceKey = (value?: string) =>
  value === "src" || value === "source";

const isFabricClassRegistrationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /fabric:\s*No class registered for/i.test(message);
};

const getMutationData = (result: any) => {
  if (result?.error) {
    throw result.error;
  }

  return result?.data;
};

const getSignedImageUrl = async ({
  generateImageUrlAlt,
  paperId,
  kind,
}: {
  generateImageUrlAlt: (request: any) => Promise<any>;
  paperId: string;
  kind: string;
}) => {
  const imageData = getMutationData(
    await generateImageUrlAlt({
      id: paperId,
      body: { kind },
    }),
  );

  if (!imageData?.signedUrl) {
    throw new Error(`No signed image URL returned for ${kind}`);
  }

  return imageData.signedUrl;
};

const sanitizeFabricJsonNode = (
  node: any,
  key?: string,
): { node: any; replaced: number } => {
  if (Array.isArray(node)) {
    let replaced = 0;
    const next = node
      .map((item) => {
        const result = sanitizeFabricJsonNode(item);
        replaced += result.replaced;
        return result.node;
      })
      .filter((item) => item !== null && item !== undefined);

    return { node: next, replaced };
  }

  if (typeof node === "string") {
    if (isBlobSrc(node) && isBlobSourceKey(key)) {
      return {
        node: LEGACY_BLOB_PLACEHOLDER_DATA_URL,
        replaced: 1,
      };
    }
    return { node, replaced: 0 };
  }

  if (!node || typeof node !== "object") {
    return { node, replaced: 0 };
  }

  let replaced = 0;
  const next: Record<string, unknown> = { ...node };

  for (const [key, value] of Object.entries(next)) {
    const result = sanitizeFabricJsonNode(value, key);
    replaced += result.replaced;

    if (result.node === null || result.node === undefined) {
      delete next[key];
    } else {
      next[key] = result.node;
    }
  }

  return { node: next, replaced };
};

const sanitizeLegacyFabricJson = (
  rawData: unknown,
): { json: unknown; replacedBlobCount: number } => {
  const isRawString = typeof rawData === "string";
  let parsed: unknown = rawData;

  if (isRawString) {
    try {
      parsed = JSON.parse(rawData);
    } catch {
      const blobMatches = rawData.match(/blob:[^"'\s)]+/g) || [];
      if (blobMatches.length === 0) {
        return { json: rawData, replacedBlobCount: 0 };
      }

      return {
        json: rawData.replace(
          /blob:[^"'\s)]+/g,
          LEGACY_BLOB_PLACEHOLDER_DATA_URL,
        ),
        replacedBlobCount: blobMatches.length,
      };
    }
  }

  const result = sanitizeFabricJsonNode(parsed);
  if (isRawString) {
    return {
      json: JSON.stringify(result.node),
      replacedBlobCount: result.replaced,
    };
  }

  return { json: result.node, replacedBlobCount: result.replaced };
};

const loadCanvasFromJson = async ({
  fabricCanvas,
  data,
}: {
  fabricCanvas: any;
  data: unknown;
}) => {
  const { json: safeJson, replacedBlobCount } = sanitizeLegacyFabricJson(data);

  if (replacedBlobCount > 0) {
    console.warn(
      `Replaced ${replacedBlobCount} stale blob URL(s) in legacy editor JSON while loading.`,
    );
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("EDITOR_LOAD_TIMEOUT"));
    }, EDITOR_LOAD_TIMEOUT_MS);

    try {
      const loadResult = fabricCanvas.loadFromJSON(safeJson);
      if (loadResult && typeof loadResult.then === "function") {
        loadResult
          .then(() => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            fabricCanvas.getObjects?.("path")?.forEach((path: any) => {
              path.set?.("fill", "");
            });
            fabricCanvas.renderAll();
            resolve();
          })
          .catch((err: unknown) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            reject(err);
          });
        return;
      }

      fabricCanvas.loadFromJSON(safeJson, () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        fabricCanvas.getObjects?.("path")?.forEach((path: any) => {
          path.set?.("fill", "");
        });
        fabricCanvas.renderAll();
        resolve();
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      reject(err);
    }
  });
};

const addImageToCanvas = async ({
  fabricCanvas,
  imageUrl,
  size,
}: {
  fabricCanvas: any;
  imageUrl: string;
  size: { width: number; height: number };
}) => {
  const image = await fabric.FabricImage.fromURL(imageUrl, {
    crossOrigin: "anonymous",
  });

  fabricCanvas.clear();
  fabricCanvas.backgroundColor = "#ffffff";

  image.set({
    left: 0,
    top: 0,
    selectable: true,
  });

  const imageWidth = image.width || size.width;
  const imageHeight = image.height || size.height;
  image.scaleX = size.width / imageWidth;
  image.scaleY = size.height / imageHeight;

  fabricCanvas.add(image);
  fabricCanvas.renderAll();
};

export default async function loadImageDataIntoEditor({
  fabricCanvas,
  generateImageUrlAlt,
  paperId,
  size,
}: LoadImageDataIntoEditorParams) {
  try {
    const editableData = getMutationData(
      await generateImageUrlAlt({
        id: paperId,
        body: { kind: "editable.json", return: "json" },
      }),
    );

    console.log("editableData", editableData);

    await loadCanvasFromJson({
      fabricCanvas,
      data: editableData,
    });
    return;
  } catch (error) {
    if (isFabricClassRegistrationError(error)) {
      throw error;
    }

    console.warn(
      "Could not load editable image data, falling back to image",
      error,
    );
  }

  let lastError: unknown;

  for (const kind of ["original.png", ".png"]) {
    try {
      const imageUrl = await getSignedImageUrl({
        generateImageUrlAlt,
        paperId,
        kind,
      });

      await addImageToCanvas({
        fabricCanvas,
        imageUrl,
        size,
      });
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Could not load ${kind} into image editor`, error);
    }
  }

  throw lastError;
}
