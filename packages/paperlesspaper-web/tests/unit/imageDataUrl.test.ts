// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadImageElement } from "../../src/components/Epaper/Integrations/ImageEditor/imageDataUrl";

let image: HTMLImageElement;
beforeEach(() => {
  vi.useFakeTimers();
  image = document.createElement("img");
  vi.stubGlobal("Image", function () { return image; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("reports stalled images after 30 seconds and cancels their load", async () => {
  const result = expect(loadImageElement("https://storage.test/image")).rejects.toThrow("EDITOR_LOAD_TIMEOUT");
  await vi.advanceTimersByTimeAsync(30_000);
  await result;
  expect(image.getAttribute("src")).toBeNull();
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it("cleans up after a missing image", async () => {
  const result = expect(loadImageElement("https://storage.test/missing")).rejects.toThrow("Image could not be loaded.");
  image.dispatchEvent(new Event("error"));
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("installs handlers before starting the load, including cached images", async () => {
  Object.defineProperty(image, "src", { set() { image.dispatchEvent(new Event("load")); } });
  await expect(loadImageElement("data:image/png;base64,test", "anonymous")).resolves.toBe(image);
  expect(image.crossOrigin).toBe("anonymous");
  expect(vi.getTimerCount()).toBe(0);
});
