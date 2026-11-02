// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ url: "https://images.example/slide-1.jpg" }));
vi.mock("@paperlesspaper/helpers", () => ({ applicationsByKind: () => ({}) }));
vi.mock("@internetderdinge/web", () => ({
  devAppsBaseReplacement: (value: unknown) => value,
  resolvePossiblyRelativeUrl: (value: unknown) => value,
  useLocaleDate: () => ({}),
  useVisibility: () => false,
}));
vi.mock("@progressiveui/react", () => ({ Empty: () => null, InlineLoading: () => null }));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => children,
  useTranslation: () => ({ t: (value: string) => value }),
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({}) }));
vi.mock("helpers/formatDistanceShort", () => ({ default: () => "" }));
vi.mock("helpers/useCurrentUser", () => ({ useDebug: () => false }));
vi.mock("helpers/useUsers", () => ({
  useActiveUserDevice: () => ({ data: { id: "device" }, isLoading: false }),
}));
vi.mock("ducks/devices", () => ({ devicesApi: { useGetImageQuery: () => ({}) } }));
vi.mock("ducks/ePaper/papersApi", () => ({
  papersApi: {
    useGenerateImageUrlQuery: () => ({ data: { signedUrl: state.url } }),
    useUploadSingleImageMutation: () => [null, {}],
    useUpdateSinglePapersMutation: () => [null, {}],
    useGetIntegrationPushContentQuery: () => ({}),
  },
}));
vi.mock("components/Calendar/NewEntryButton", () => ({ default: () => null }));
vi.mock("components/Settings/components/AddIcon", () => ({ default: () => null }));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useEditor", () => ({
  default: () => ({}),
}));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useRotationList", () => ({
  default: () => ({
    portrait: { width: 480, height: 800 },
    landscape: { width: 800, height: 480 },
  }),
}));
vi.mock("../../src/components/Epaper/Overview/FrameViewport", () => ({
  default: ({ size, children }: any) => (
    <div data-orientation={size.width > size.height ? "landscape" : "portrait"}>
      {children({ scale: 1 })}
    </div>
  ),
}));
vi.mock("../../src/components/Epaper/Overview/IntegrationPreview", () => ({ default: () => null }));
vi.mock("../../src/components/Epaper/Overview/PhotoFrameMeta", () => ({ default: () => null }));

import PhotoFrame from "../../src/components/Epaper/Overview/PhotoFrame";

it("follows the loaded slide across portrait/landscape changes without changing ordinary image orientation", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  const paper = { id: "slideshow", kind: "slides", meta: { orientation: "portrait" } };
  const orientation = () => host.firstElementChild?.querySelector("[data-orientation]")?.getAttribute("data-orientation");
  const loadImage = (width: number, height: number) => {
    const image = host.querySelector("img")!;
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: width },
      naturalHeight: { configurable: true, value: height },
    });
    act(() => image.dispatchEvent(new Event("load")));
  };
  try {
    act(() => root.render(<PhotoFrame paper={paper} />));
    loadImage(800, 480);
    expect(orientation()).toBe("landscape");

    state.url = "https://images.example/slide-2.jpg";
    act(() => root.render(<PhotoFrame paper={paper} />));
    expect(orientation()).toBe("portrait");
    loadImage(480, 800);
    expect(orientation()).toBe("portrait");

    state.url = "https://images.example/slide-3.jpg";
    act(() => root.render(<PhotoFrame paper={paper} />));
    loadImage(800, 480);
    expect(orientation()).toBe("landscape");

    act(() => root.render(<PhotoFrame paper={{ ...paper, kind: "image" }} />));
    expect(orientation()).toBe("portrait");
  } finally {
    act(() => root.unmount());
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  }
});
