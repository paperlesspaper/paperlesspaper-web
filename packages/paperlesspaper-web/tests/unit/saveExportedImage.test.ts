// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  write: vi.fn(),
  share: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.native },
}));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: mocks.write },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: mocks.share } }));
import {
  canShareImage,
  downloadImage,
  isShareCancelled,
  shareImage,
} from "../../src/components/Epaper/Integrations/ImageEditor/saveExportedImage";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.native.mockReturnValue(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("shares the prepared browser File immediately from the click", async () => {
  const file = new File(["png"], "image.png", { type: "image/png" });
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: () => true,
  });
  expect(canShareImage(file)).toBe(true);
  const promise = shareImage(file);
  expect(share).toHaveBeenCalledWith({ files: [file] });
  await promise;
});
it("writes a native image to shareable cache and shares its URI", async () => {
  mocks.native.mockReturnValue(true);
  mocks.write.mockResolvedValue({ uri: "file:///cache/image.jpg" });
  mocks.share.mockResolvedValue({});
  await shareImage(new File(["image"], "image.jpg", { type: "image/jpeg" }));
  expect(mocks.write).toHaveBeenCalledWith({
    directory: "CACHE",
    data: btoa("image"),
    recursive: true,
    path: expect.stringMatching(/^image-export-.*\/image.jpg$/),
  });
  expect(mocks.share).toHaveBeenCalledWith({
    files: ["file:///cache/image.jpg"],
  });
});
it("does not share when writing the native file fails", async () => {
  mocks.native.mockReturnValue(true);
  mocks.write.mockRejectedValue(new Error("disk full"));
  await expect(shareImage(new File(["image"], "image.png"))).rejects.toThrow(
    "disk full",
  );
  expect(mocks.share).not.toHaveBeenCalled();
});
it("downloads with a filename and revokes the object URL after the browser has consumed it", () => {
  vi.useFakeTimers();
  const create = vi.fn(() => "blob:export");
  const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: create,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revoke,
  });
  let name: string;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function () {
      name = this.download;
    },
  );
  downloadImage(new File(["png"], "image.png"));
  expect(name).toBe("image.png");
  expect(document.querySelector("a")).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith("blob:export");
});
it("distinguishes cancellation from genuine failures", () => {
  expect(isShareCancelled(new DOMException("", "AbortError"))).toBe(true);
  expect(isShareCancelled({ message: "Share canceled" })).toBe(true);
  expect(isShareCancelled({ message: "Share cancelled" })).toBe(true);
  expect(isShareCancelled({ message: "Permission denied" })).toBe(false);
});
