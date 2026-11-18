// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import useImageEditorTools from "../../src/components/Epaper/Integrations/ImageEditor/useImageEditorTools";

it("keeps the selected object and photo tools in sync when rotating the frame", () => {
  const image = {
    type: "image",
    left: 240,
    top: 400,
    set: vi.fn(),
    setCoords: vi.fn(),
  };
  const other = {
    type: "rect",
    left: 10,
    top: 20,
    set: vi.fn(),
    setCoords: vi.fn(),
  };
  const canvas = {
    getActiveObject: () => image,
    getObjects: () => [image, other],
    setDimensions: vi.fn(),
    setViewportTransform: vi.fn(),
    renderAll: vi.fn(),
  };
  const baseCanvasSizeRef = { current: { width: 480, height: 800 } };
  const setValue = vi.fn();
  const result = {
    current: null as ReturnType<typeof useImageEditorTools> | null,
  };
  function Probe() {
    result.current = useImageEditorTools({
      fabricRef: { current: canvas },
      baseCanvasSizeRef,
      currentScaleRef: { current: 1 },
      wrapperRef: { current: { offsetWidth: 1000, offsetHeight: 600 } },
      store: {
        size: { name: "portrait", width: 480, height: 800 },
        rotationList: {
          landscape: { name: "landscape", width: 800, height: 480 },
        },
        form: { setValue },
      },
    });
    return null;
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  act(() => result.current!.setActiveObject(image as any));
  act(() => result.current!.rotateScreen());
  expect(result.current!.activeObject).toBe(image);
  expect(canvas.getActiveObject()).toBe(image);
  expect(baseCanvasSizeRef.current).toEqual({ width: 800, height: 480 });
  expect(canvas.setDimensions).toHaveBeenLastCalledWith({
    width: 1000,
    height: 600,
  });
  expect(setValue).toHaveBeenCalledWith("meta.orientation", "landscape", {
    shouldDirty: true,
  });
  act(() => root.unmount());
});
