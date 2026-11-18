// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  edited: null as any,
  preview: null as any,
  currentContent: {
    text: "PRIVATE PAPER CONTENT",
    imageUrl: "https://storage.example/private-signed-image",
  } as any,
}));
vi.mock("@paperlesspaper/helpers", () => ({ applicationsByKind: () => ({}) }));
vi.mock("@internetderdinge/web", () => ({
  devAppsBaseReplacement: (v: any) => v,
  resolvePossiblyRelativeUrl: (v: any, b: any) => new URL(v, b).href,
  useLocaleDate: () => ({}),
  useVisibility: () => false,
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ paper: "paper" }) }));
vi.mock("helpers/formatDistanceShort", () => ({ default: () => "" }));
vi.mock("helpers/useCurrentUser", () => ({ useDebug: () => false }));
vi.mock("helpers/useUsers", () => ({
  useActiveUserDevice: () => ({ data: undefined }),
}));
vi.mock("ducks/devices", () => ({
  devicesApi: {
    useGetImageQuery: () => ({}),
    endpoints: { getSingleDevices: { useQuerySubscription: () => ({}) } },
  },
}));
vi.mock("ducks/ePaper/papersApi", () => ({
  papersApi: {
    useGenerateImageUrlQuery: () => ({}),
    useUploadSingleImageMutation: () => [null, {}],
    useUpdateSinglePapersMutation: () => [null, {}],
    useGetIntegrationPushContentQuery: () => ({
      currentData: m.currentContent
        ? {
            content: m.currentContent,
            configUrl: "https://trusted.example/config.json",
            renderUrl: "https://trusted.example/render.html",
          }
        : undefined,
      data: {
        content: {
          text: "PRIVATE PAPER CONTENT",
          imageUrl: "https://storage.example/private-signed-image",
        },
      },
    }),
  },
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useEditor",
  () => ({
    default: () => ({ form: { watch: () => m.edited }, setModalOpen: vi.fn() }),
  })
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useRotationList",
  () => ({
    default: () => ({
      portrait: { width: 480, height: 800 },
      landscape: { width: 800, height: 480 },
    }),
  })
);
vi.mock("../../src/components/Epaper/Overview/FrameViewport", () => ({
  default: ({ children }: any) => children({ scale: 1 }),
}));
vi.mock("../../src/components/Epaper/Overview/IntegrationPreview", () => ({
  default: (props: any) => {
    m.preview = props;
    return null;
  },
}));
vi.mock("../../src/components/Epaper/Overview/PhotoFrameContent", () => ({
  default: () => null,
}));
vi.mock("../../src/components/Epaper/Overview/PhotoFrameMeta", () => ({
  default: () => null,
}));
import PhotoFrame from "../../src/components/Epaper/Overview/PhotoFrame";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  m.currentContent = {
    text: "PRIVATE PAPER CONTENT",
    imageUrl: "https://storage.example/private-signed-image",
  };
});
it("must not send private content to meta.url when edited render-page override is missing", async () => {
  const saved = {
    id: "paper",
    kind: "plugin",
    meta: {
      pluginConfigUrl: "https://trusted.example/config.json",
      pluginRenderPage: "https://trusted.example/render.html",
      pluginManifest: {
        renderPage: "./render.html",
        capabilities: { contentPush: {} },
      },
    },
  };
  m.edited = {
    ...saved,
    meta: {
      ...saved.meta,
      pluginRenderPage: "",
      url: "https://other.example/render",
    },
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<PhotoFrame variant="preview" paper={saved} />)
    );
    expect(m.preview.url).toBe("https://other.example/render");
    expect(m.preview.initData.integrationContent).toBeUndefined();
  } finally {
    act(() => root.unmount());
  }
});

it("passes content to the saved renderer but never reuses another paper's cached response", async () => {
  const saved = {
    id: "paper",
    kind: "plugin",
    meta: {
      pluginConfigUrl: "https://trusted.example/config.json",
      pluginRenderPage: "https://trusted.example/render.html",
      pluginManifest: {
        renderPage: "./render.html",
        capabilities: { contentPush: {} },
      },
    },
  };
  m.edited = saved;
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () =>
      root.render(<PhotoFrame variant="preview" paper={saved} />)
    );
    expect(m.preview.initData.integrationContent.text).toBe(
      "PRIVATE PAPER CONTENT"
    );
    m.currentContent = undefined;
    await act(async () =>
      root.render(
        <PhotoFrame
          variant="preview"
          paper={{ ...saved, id: "another-paper" }}
        />
      )
    );
    expect(m.preview.initData.integrationContent).toBeUndefined();
  } finally {
    act(() => root.unmount());
  }
});

it("does not forward cached content when the saved provider changes on the same paper", async () => {
  const saved = {
    id: "paper",
    kind: "plugin",
    meta: {
      pluginConfigUrl: "https://other.example/config.json",
      pluginRenderPage: "https://other.example/render.html",
      pluginManifest: {
        renderPage: "./render.html",
        capabilities: { contentPush: {} },
      },
    },
  };
  m.edited = saved;
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () =>
      root.render(<PhotoFrame variant="preview" paper={saved} />)
    );
    expect(m.preview.url).toBe("https://other.example/render.html");
    expect(m.preview.initData.integrationContent).toBeUndefined();
  } finally {
    act(() => root.unmount());
  }
});
