// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: null as any,
  canvas: null as any,
  deviceBlob: null as Blob | null,
  previewBlob: null as Blob | null,
  generatePreview: vi.fn(),
}));
vi.mock("react-i18next", () => ({ Trans: ({ children }: any) => children }));
vi.mock("helpers/useQs", () => ({ default: () => ({}) }));
vi.mock("helpers/shareTarget", () => ({
  getShareTargetPayload: () => null,
  getShareTargetImageDataUrl: vi.fn(),
}));
vi.mock("../../src/components/Epaper/Integrations/IntegrationModal", () => ({ default: () => null }));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/ImageEditorElements", () => ({ default: () => null }));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/Editor", () => ({ default: () => null }));
vi.mock("../../src/components/Epaper/Integrations/useIntegrationForm", () => ({ default: () => mocks.store }));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useImageEditorTools", () => ({
  default: ({ fabricRef, renderCanvasRef, previewCanvasRef }: any) => {
    fabricRef.current = mocks.canvas;
    renderCanvasRef.current = { toBlob: (callback: any) => callback(mocks.deviceBlob) };
    previewCanvasRef.current = { toBlob: (callback: any) => callback(mocks.previewBlob) };
    return { generatePreview: mocks.generatePreview, resizeCanvas: vi.fn() };
  },
}));

import ImageEditor, { type ImageEditorHandle } from "../../src/components/Epaper/Integrations/ImageEditor/ImageEditor";

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.deviceBlob = new Blob(["native panel colors"], { type: "image/png" });
  mocks.previewBlob = new Blob(["already reduced preview colors"], { type: "image/png" });
  mocks.canvas = {
    discardActiveObject: vi.fn(), requestRenderAll: vi.fn(),
    toObject: () => ({ objects: [] }),
    width: 800, height: 480, viewportTransform: [1, 0, 0, 1, 0, 0],
    enableRetinaScaling: false, skipControlsDrawing: false,
    calcViewportBoundaries: vi.fn(),
    toCanvasElement: vi.fn(() => ({
      toBlob: (callback: any, type: string) => callback(new Blob(["full color source"], { type })),
    })),
  };
  mocks.store = {
    urlId: "new", size: { width: 800, height: 480 },
    form: { setValue: vi.fn(), getValues: () => ({ orientation: "landscape" }) },
  };
  root = createRoot(document.createElement("div"));
});
afterEach(() => act(() => root.unmount()));

const readBlob = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

it.each([[800, 480], [480, 800]])("saves the full color original at %i × %i alongside the unchanged panel image", async (width, height) => {
  mocks.store.size = { width, height };
  const ref = React.createRef<ImageEditorHandle>();
  await act(async () => root.render(<ImageEditor ref={ref} />));
  let result: Awaited<ReturnType<ImageEditorHandle["exportImageData"]>>;
  await act(async () => { result = await ref.current!.exportImageData(); });
  expect(result!.dataDirect).toBe(mocks.deviceBlob);
  expect(await readBlob(result!.dataOriginal)).toBe("full color source");
  expect(mocks.canvas.toCanvasElement).toHaveBeenCalledWith(1, { width, height });
  expect(mocks.store.form.setValue).toHaveBeenCalledWith("dataOriginal", result!.dataOriginal);
});
