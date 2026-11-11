// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@progressiveui/react", () => ({ InlineLoading: () => null }));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => children,
  useTranslation: () => ({ t: (s: string) => s }),
}));
import OpenIntegrationSettingsIframe from "../../src/components/Epaper/Integrations/OpenIntegrationEditor/OpenIntegrationSettingsIframe";
import { samePushIntegration } from "../../src/helpers/integrationPush";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let dispose = () => {};
afterEach(() => dispose());
async function setup(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const grant = vi.fn().mockResolvedValue({ grant: "one-time-code" });
  await act(async () =>
    root.render(
      <OpenIntegrationSettingsIframe
        url="https://integration.example/settings.html"
        expectedOrigin="https://integration.example"
        onConnectionRequest={grant}
        initMessage={{
          source: "paperlesspaper-app",
          type: "INIT",
          payload: {
            settings: {},
            nativeSettings: {},
            device: {},
            app: {},
            paper: { id: "paper" },
          },
        }}
        {...props}
      />
    )
  );
  const frame = container.querySelector("iframe")!;
  const post = frame ? vi.spyOn(frame.contentWindow!, "postMessage") : vi.fn();
  dispose = () => {
    act(() => root.unmount());
    container.remove();
  };
  return { frame, grant, post, container };
}
it.each([
  { url: "data:text/html,<script></script>", expectedOrigin: null },
  { url: "javascript:alert(1)", expectedOrigin: null },
  { url: "/relative-settings", expectedOrigin: null },
  { url: "http://integration.example/settings", expectedOrigin: null },
  { url: "http://192.168.1.2/settings", expectedOrigin: null },
  {
    url: "https://user:password@integration.example/settings",
    expectedOrigin: null,
  },
  {
    url: "https://integration.example/settings",
    expectedOrigin: "https://other.example",
  },
])("refuses an invalid or mismatched settings origin: $url", async (props) => {
  const { frame, grant, post, container } = await setup(props);
  expect(frame).toBeNull();
  expect(container.textContent).toContain("Invalid integration URL");
  expect(grant).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

it.each(["localhost", "127.0.0.1", "[::1]"])(
  "allows loopback HTTP for local integration development at %s",
  async (host) => {
    const origin = `http://${host}:3200`;
    const { frame, post } = await setup({
      url: `${origin}/settings`,
      expectedOrigin: origin,
    });
    expect(frame).not.toBeNull();
    await act(async () => frame.dispatchEvent(new Event("load")));
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.every((call) => call[1] === origin)).toBe(true);
  }
);

it("sends initialization and redirect credentials only to the exact settings origin", async () => {
  const { frame, post } = await setup({
    redirectMessage: {
      source: "paperlesspaper-app",
      type: "REDIRECT",
      payload: { tempToken: "private", redirectUrl: "https://app.example" },
    },
  });
  await act(async () => frame.dispatchEvent(new Event("load")));
  expect(post).toHaveBeenCalledTimes(4);
  expect(
    post.mock.calls.every((call) => call[1] === "https://integration.example")
  ).toBe(true);
});
it("returns a one-time grant only to the expected iframe and origin", async () => {
  const { frame, grant, post } = await setup();
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: frame.contentWindow,
        origin: "https://integration.example",
        data: {
          source: "paperlesspaper-plugin",
          type: "REQUEST_CONNECTION",
          payload: { requestId: "request" },
        },
      })
    )
  );
  expect(grant).toHaveBeenCalledOnce();
  expect(post).toHaveBeenCalledWith(
    {
      source: "paperlesspaper-app",
      type: "CONNECTION_GRANT",
      payload: { requestId: "request", grant: "one-time-code" },
    },
    "https://integration.example"
  );
});
it("ignores messages from a different origin or window", async () => {
  const { frame, grant } = await setup();
  const data = {
    source: "paperlesspaper-plugin",
    type: "REQUEST_CONNECTION",
    payload: { requestId: "request" },
  };
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: frame.contentWindow,
        origin: "https://evil.example",
        data,
      })
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "https://integration.example",
        data,
      })
    );
  });
  expect(grant).not.toHaveBeenCalled();
});
it("does not deliver a pending grant after settings have been closed", async () => {
  const { frame, grant, post } = await setup();
  let finish: (value: { grant: string }) => void;
  grant.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
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
  expect(grant).toHaveBeenCalledOnce();
  dispose();
  dispose = () => {};
  await act(async () => {
    finish!({ grant: "private-code" });
  });
  expect(post).not.toHaveBeenCalled();
});
it("keeps server errors and credentials out of the plugin response", async () => {
  const { frame, grant, post } = await setup();
  grant.mockRejectedValue(new Error("private server details"));
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: frame.contentWindow,
        origin: "https://integration.example",
        data: {
          source: "paperlesspaper-plugin",
          type: "REQUEST_CONNECTION",
          payload: { requestId: "request" },
        },
      })
    )
  );
  expect(post.mock.calls[0][0].payload).toEqual({
    requestId: "request",
    error: "Save the paper and reconnect",
  });
});
it("does not forward preview content after unsaved renderer changes", () => {
  const saved = {
    kind: "plugin",
    meta: {
      pluginConfigUrl: "https://integration.example/config.json",
      pluginManifest: {
        renderPage: "./render.html",
        capabilities: { contentPush: {} },
      },
    },
  };
  expect(
    samePushIntegration(saved, saved, "https://integration.example/render.html")
  ).toBe(true);
  expect(
    samePushIntegration(
      {
        ...saved,
        meta: {
          ...saved.meta,
          pluginRenderPage: "https://evil.example/render",
        },
      },
      saved,
      "https://evil.example/render"
    )
  ).toBe(false);
  expect(
    samePushIntegration(
      saved,
      undefined,
      "https://integration.example/render.html"
    )
  ).toBe(false);
});
