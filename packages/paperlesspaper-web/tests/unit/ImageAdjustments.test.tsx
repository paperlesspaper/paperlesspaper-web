// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => children,
  useTranslation: () => ({ t: (value: string) => value }),
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/ImageEditor",
  () => ({
    useImageEditorContext: () => ({ fabricRef: { current: null } }),
  })
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useEditor",
  () => ({ default: () => ({}) })
);
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/Clarity", () => ({
  default: () => null,
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/imageAdjustmentFilters",
  () => ({
    registerEpdImageAdjustmentsIfNeeded: vi.fn(),
    useCanvas2dFilterBackend: vi.fn(),
    getSettingsFromFilter: () => ({ exposure: 0 }),
  })
);
// The details pane re-renders the latest modal descriptor when canvas context
// changes. Use the same element/component distinction as the real EditorButton.
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/EditorButton",
  () => ({
    default: ({ id, modalComponent: Component }: any) => {
      if (id !== "image-adjustments-exposure") return null;
      return React.isValidElement(Component) ? Component : <Component />;
    },
  })
);
import ImageAdjustments from "../../src/components/Epaper/Integrations/ImageEditor/ImageAdjustments";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
it("keeps the chosen exposure when the surrounding editor re-renders", () => {
  act(() => root.render(<ImageAdjustments />));
  const slider = container.querySelector(
    "input[type=range]"
  ) as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(slider, "0.2");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(slider.value).toBe("0.2");
  act(() => root.render(<ImageAdjustments />));
  expect(
    (container.querySelector("input[type=range]") as HTMLInputElement).value
  ).toBe("0.2");
  expect(container.querySelector("output")?.textContent).toBe("+0.20");
});
