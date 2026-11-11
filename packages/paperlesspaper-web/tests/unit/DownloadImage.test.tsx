// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  export: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
  canShare: vi.fn(),
  canvas: { current: {} },
  tools: { getCanvasSize: () => ({ width: 1200, height: 800 }), imageLoadError: null as string | null },
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/ImageEditor",
  () => ({
    useImageEditorContext: () => ({
      fabricRef: mocks.canvas,
      imageEditorTools: mocks.tools,
    }),
  }),
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/EditorButton",
  () => ({
    default: ({ text, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>{text}</button>
    ),
  }),
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/exportImage",
  () => ({ exportImage: mocks.export }),
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/saveExportedImage",
  () => ({
    canShareImage: mocks.canShare,
    downloadImage: mocks.download,
    shareImage: mocks.share,
    isShareCancelled: (error: any) => error.name === "AbortError",
  }),
);
vi.mock("react-device-detect", () => ({ isMobile: true }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Modal: ({ children, open }: any) =>
    open ? <div role="dialog">{children}</div> : null,
}));
import DownloadImage from "../../src/components/Epaper/Integrations/ImageEditor/DownloadImage";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const click = async (text: string, dialog = false) =>
  act(async () => {
    const scope = dialog
      ? container.querySelector('[role="dialog"]')!
      : container;
    const button = Array.from(scope.querySelectorAll("button")).find(
      (el) => el.textContent === text,
    )!;
    button.click();
  });
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.tools.imageLoadError = null;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.canShare.mockReturnValue(false);
  mocks.export.mockImplementation(
    async (_canvas, _size, format) =>
      new File(["data"], `image.${format}`, { type: `image/${format}` }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<DownloadImage />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
it("prevents downloading a blank image after loading failed", async () => {
  mocks.tools.imageLoadError = "Image could not be loaded";
  await act(async () => root.render(<DownloadImage />));
  expect(container.querySelector("button")?.disabled).toBe(true);
  await click("Download");
  expect(mocks.export).not.toHaveBeenCalled();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});
it("requires confirmation and does not download when opening or cancelling", async () => {
  expect(mocks.export).not.toHaveBeenCalled();
  await click("Download");
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(mocks.download).not.toHaveBeenCalled();
  await click("Cancel");
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.share).not.toHaveBeenCalled();
});
it.each(["jpeg", "png"])(
  "downloads the selected %s only after confirmation",
  async (format) => {
    await click("Download");
    await act(async () =>
      (
        container.querySelector(`input[value="${format}"]`) as HTMLInputElement
      ).click(),
    );
    await click("Download", true);
    expect(mocks.download).toHaveBeenCalledWith(
      expect.objectContaining({ type: `image/${format}` }),
    );
  },
);
it("keeps the dialog open on cancelled sharing, with no fallback download", async () => {
  mocks.canShare.mockReturnValue(true);
  mocks.share.mockRejectedValueOnce(
    new DOMException("cancelled", "AbortError"),
  );
  await click("Download");
  await click("Save / Share");
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(mocks.download).not.toHaveBeenCalled();
});
it("reports export errors and supports retry", async () => {
  mocks.export.mockRejectedValueOnce(new Error("encoding failed"));
  await click("Download");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await click("Try again");
  await click("Download", true);
  expect(mocks.download).toHaveBeenCalledTimes(1);
});
