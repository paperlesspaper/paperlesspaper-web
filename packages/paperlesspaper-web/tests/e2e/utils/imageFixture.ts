// Valid 4x4 RGB PNG with opaque red pixels, shared by upload and share-target tests.
export const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVR4nGO4o2EDRwzEcQASUhQBSAx55AAAAABJRU5ErkJggg==",
  "base64",
);

export const testPngDataUrl = `data:image/png;base64,${testPng.toString("base64")}`;
