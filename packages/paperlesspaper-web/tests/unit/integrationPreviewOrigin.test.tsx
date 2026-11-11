// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@progressiveui/react", () => ({ Empty: () => null }));
vi.mock("react-i18next", () => ({
  Trans: () => null,
  useTranslation: () => ({ t: (s: string) => s }),
}));
import IntegrationPreview from "../../src/components/Epaper/Overview/IntegrationPreview";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it("sends preview data only to its configured origin and replaces the frame on navigation", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const props = {
    initData: { integrationContent: { text: "Private" } },
    calendarPostData: { events: [] },
    onSelectWebsite: () => {},
    scale: 1,
    shouldShowEmptyMessage: false,
    size: { width: 800, height: 480 } as any,
  };
  try {
    await act(async () =>
      root.render(
        <IntegrationPreview {...props} url="https://trusted.example/render" />
      )
    );
    const first = host.querySelector("iframe")!;
    const post = vi.spyOn(first.contentWindow!, "postMessage");
    await act(async () => first.dispatchEvent(new Event("load")));
    expect(post).toHaveBeenCalledTimes(2);
    expect(
      post.mock.calls.every((call) => call[1] === "https://trusted.example")
    ).toBe(true);
    await act(async () =>
      root.render(
        <IntegrationPreview {...props} url="https://other.example/render" />
      )
    );
    expect(host.querySelector("iframe")).not.toBe(first);
    expect(post).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  }
});
