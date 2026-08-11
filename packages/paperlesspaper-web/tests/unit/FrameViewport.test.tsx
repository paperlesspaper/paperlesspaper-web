import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import FrameViewport from "../../src/components/Epaper/Overview/FrameViewport";
import {
  containFrame,
  FRAME_FINISHES,
  PRIMARY_FRAME_DECORATION,
} from "../../src/components/Epaper/Overview/photoFrameModel";

describe("FrameViewport", () => {
  const availableWidth = 900;
  let availableHeight = 900;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    availableHeight = 900;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => availableWidth
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      () => availableHeight
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps a decorated landscape viewport at the device ratio", () => {
    const expected = containFrame(
      { width: availableWidth, height: availableHeight },
      { width: 800, height: 480 },
      PRIMARY_FRAME_DECORATION
    );

    act(() => {
      root.render(
        <FrameViewport decorated size={{ width: 800, height: 480 }}>
          {() => <div>content</div>}
        </FrameViewport>
      );
    });

    const chrome = container.querySelector<HTMLElement>("[data-frame-chrome]");
    const mat = container.querySelector<HTMLElement>("[data-frame-mat]");
    const viewport = container.querySelector<HTMLElement>(
      "[data-frame-viewport]"
    );
    const woodRails = container.querySelectorAll<HTMLElement>(
      "[data-frame-wood-rail]"
    );

    expect(chrome?.style.width).toBe(`${expected.frame.width}px`);
    expect(chrome?.style.height).toBe(`${expected.frame.height}px`);
    expect(chrome?.style.getPropertyValue("--frame-padding")).toBe(
      `${expected.decoration.framePadding}px`
    );
    expect(chrome?.style.getPropertyValue("--frame-mat-padding")).toBe(
      `${expected.decoration.matPadding}px`
    );
    expect(mat).not.toBeNull();
    expect(viewport?.style.width).toBe(`${expected.viewport.width}px`);
    expect(viewport?.style.height).toBe(`${expected.viewport.height}px`);
    expect(viewport?.style.aspectRatio).toBe("800 / 480");
    expect(Array.from(woodRails, (rail) => rail.dataset.frameWoodRail)).toEqual(
      ["top", "right", "bottom", "left"]
    );
    expect(
      container
        .querySelector("[data-frame-decoration]")
        ?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("uses the height constraint for a portrait viewport", () => {
    availableHeight = 600;
    const expected = containFrame(
      { width: availableWidth, height: availableHeight },
      { width: 480, height: 800 },
      PRIMARY_FRAME_DECORATION
    );

    act(() => {
      root.render(
        <FrameViewport decorated size={{ width: 480, height: 800 }}>
          {() => <div>content</div>}
        </FrameViewport>
      );
    });

    const chrome = container.querySelector<HTMLElement>("[data-frame-chrome]");
    const viewport = container.querySelector<HTMLElement>(
      "[data-frame-viewport]"
    );

    expect(chrome?.style.width).toBe(`${expected.frame.width}px`);
    expect(chrome?.style.height).toBe(`${expected.frame.height}px`);
    expect(chrome?.style.getPropertyValue("--frame-padding")).toBe(
      `${expected.decoration.framePadding}px`
    );
    expect(chrome?.style.getPropertyValue("--frame-mat-padding")).toBe(
      `${expected.decoration.matPadding}px`
    );
    expect(viewport?.style.width).toBe(`${expected.viewport.width}px`);
    expect(viewport?.style.height).toBe(`${expected.viewport.height}px`);
  });

  it.each(FRAME_FINISHES)(
    "renders the %s finish with the same four wood rails",
    (frameFinish) => {
      act(() => {
        root.render(
          <FrameViewport
            decorated
            frameFinish={frameFinish}
            size={{ width: 800, height: 480 }}
          >
            {() => <div>content</div>}
          </FrameViewport>
        );
      });

      expect(
        container
          .querySelector("[data-frame-chrome]")
          ?.getAttribute("data-frame-finish")
      ).toBe(frameFinish);
      expect(container.querySelectorAll("[data-frame-wood-rail]")).toHaveLength(
        4
      );
    }
  );
});
