import { deviceByKind } from "@paperlesspaper/helpers";

export const haveDifferentFrameSizes = (
  expectedFrameKind?: string,
  paperFrameKind?: string,
) => {
  if (!expectedFrameKind || !paperFrameKind) return false;

  const expectedResolution = deviceByKind(expectedFrameKind)?.resolution;
  const paperResolution = deviceByKind(paperFrameKind)?.resolution;

  if (!expectedResolution || !paperResolution) {
    return false;
  }

  return (
    expectedResolution.width !== paperResolution.width ||
    expectedResolution.height !== paperResolution.height
  );
};
