// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  grant: vi.fn(),
  token: vi.fn(),
  revoke: vi.fn(),
}));
const state = vi.hoisted(() => ({
  paperId: "paper",
  config: "https://integration.example/config.json",
  settings: "./settings.html",
  manifest: { name: "Test", capabilities: { contentPush: {} } },
}));
vi.mock("@progressiveui/react", () => ({ InlineLoading: () => null }));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => children,
  useTranslation: () => ({ t: (s: string) => s }),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ paper: state.paperId }),
}));
vi.mock("ducks/ePaper/papersApi", () => ({
  papersApi: {
    useCreatePluginRedirectTokenMutation: () => [api.token],
    useCreateIntegrationPushGrantMutation: () => [api.grant],
    useRevokeIntegrationPushConnectionMutation: () => [api.revoke],
  },
}));
vi.mock(
  "../../src/components/Epaper/Integrations/OpenIntegrationEditor/OpenIntegrationSchemaForm",
  () => ({ default: () => null })
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useEditor",
  () => {
    const form = {
      watch: (key: string) =>
        ({
          "meta.pluginConfigUrl": state.config,
          "meta.pluginSettingsPage": state.settings,
          "meta.pluginManifest": state.manifest,
        }[key]),
      getValues: () => undefined,
      setValue: vi.fn(),
    };
    return { default: () => ({ form }) };
  }
);
import PluginIframeModal from "../../src/components/Epaper/Integrations/OpenIntegrationEditor/PluginIframeModal";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let dispose = () => {};
afterEach(() => {
  dispose();
  vi.clearAllMocks();
  state.settings = "./settings.html";
});

it.each([false, true])(
  "%s settings-page change while a grant is pending",
  async (changeSettingsPage) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    dispose = () => {
      act(() => root.unmount());
      container.remove();
    };
    let finish: (value: { grant: string }) => void;
    api.token.mockReturnValue({ unwrap: async () => ({}) });
    api.grant.mockReturnValue({
      unwrap: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await act(async () => root.render(<PluginIframeModal />));
    const frame = container.querySelector("iframe")!;
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    await act(async () =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source: frame.contentWindow,
          origin: "https://integration.example",
          data: {
            source: "paperlesspaper-plugin",
            type: "REQUEST_CONNECTION",
            payload: { requestId: "pending" },
          },
        })
      )
    );
    expect(api.grant).toHaveBeenCalledOnce();
    if (changeSettingsPage) state.settings = "./other-settings.html";
    // Resizing (or RTK's mutation state) re-renders the real parent while waiting.
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: frame.contentWindow,
          origin: "https://integration.example",
          data: {
            source: "paperlesspaper-plugin",
            type: "SET_HEIGHT",
            payload: { height: 700 },
          },
        })
      );
    });
    await act(async () => finish!({ grant: "private-code" }));
    if (changeSettingsPage) expect(post).not.toHaveBeenCalled();
    else
      expect(post).toHaveBeenCalledWith(
        {
          source: "paperlesspaper-app",
          type: "CONNECTION_GRANT",
          payload: { requestId: "pending", grant: "private-code" },
        },
        "https://integration.example"
      );
  }
);
