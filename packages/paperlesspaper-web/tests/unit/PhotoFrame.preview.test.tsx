// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useForm, type UseFormReturn } from "react-hook-form";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ form: null as UseFormReturn<any> | null }));
vi.mock("@paperlesspaper/helpers", () => ({ applicationsByKind: () => ({}) }));
vi.mock("@internetderdinge/web", () => ({
  devAppsBaseReplacement: (value: unknown) => value,
  resolvePossiblyRelativeUrl: (value: string, base: string) => new URL(value, base).href,
  useLocaleDate: () => ({}),
  useVisibility: () => false,
}));
vi.mock("@progressiveui/react", () => ({ Button: "button", Empty: "div" }));
vi.mock("react-i18next", () => ({
  Trans: "span",
  useTranslation: () => ({ t: (value: string) => value }),
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ paper: "paper" }) }));
vi.mock("helpers/formatDistanceShort", () => ({ default: () => "" }));
vi.mock("helpers/useCurrentUser", () => ({ useDebug: () => false }));
vi.mock("helpers/useUsers", () => ({ useActiveUserDevice: () => ({}) }));
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
    useGetIntegrationPushContentQuery: () => ({}),
  },
}));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useEditor", () => ({
  default: () => ({ form: state.form, setModalOpen: vi.fn() }),
}));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useRotationList", () => ({
  default: () => ({
    portrait: { width: 480, height: 800 },
    landscape: { width: 800, height: 480 },
  }),
}));
vi.mock("../../src/components/Epaper/Overview/FrameViewport", () => ({
  default: ({ children }: any) => children({ scale: 1 }),
}));
vi.mock("../../src/components/Epaper/Overview/PhotoFrameContent", () => ({ default: () => null }));
vi.mock("../../src/components/Epaper/Overview/PhotoFrameMeta", () => ({ default: () => null }));

import PhotoFrame from "../../src/components/Epaper/Overview/PhotoFrame";

it("sends nested form edits to the existing preview without waiting for new calendar data", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const paper = {
    id: "paper",
    kind: "plugin",
    meta: {
      pluginConfigUrl: "https://integrations.example/calendar/config.json",
      pluginRenderPage: "https://integrations.example/calendar/render.html",
      pluginSettings: { view: "agenda", fontScale: 100 },
      calendarData: { events: [{ summary: "Design review" }] },
    },
  };
  function Editor() {
    state.form = useForm({ defaultValues: paper });
    return <PhotoFrame variant="preview" paper={paper} />;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<Editor />));
    const iframe = host.querySelector("iframe")!;
    const messages: any[] = [];
    vi.spyOn(iframe.contentWindow!, "postMessage").mockImplementation((message) => {
      // postMessage delivers a snapshot rather than a reference to form state.
      messages.push(JSON.parse(JSON.stringify(message)));
    });
    act(() => iframe.dispatchEvent(new Event("load")));
    expect(messages.at(-1).data.meta.pluginSettings.view).toBe("agenda");

    for (const view of ["rolling-week", "day-timeline", "year"]) {
      messages.length = 0;
      act(() => state.form!.setValue("meta.pluginSettings.view", view));
      expect(host.querySelector("iframe")).toBe(iframe);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.at(-1).data.meta.pluginSettings.view).toBe(view);
      expect(messages.at(-1).data.calendarData.events).toEqual(paper.meta.calendarData.events);
    }

    act(() => state.form!.setValue("meta.pluginSettings.fontScale", 125));
    expect(messages.at(-1).data.meta.pluginSettings.fontScale).toBe(125);
    act(() => state.form!.setValue("meta.calendarData.events", [{ summary: "Updated event" }]));
    expect(messages.at(-1).data.calendarData.events).toEqual([{ summary: "Updated event" }]);
    act(() => iframe.dispatchEvent(new Event("load")));
    expect(messages.at(-1).data.meta.pluginSettings.view).toBe("year");
    expect(messages.at(-1).data.meta.pluginSettings.fontScale).toBe(125);
    expect(paper.meta.pluginSettings.view).toBe("agenda");
  } finally {
    act(() => root.unmount());
    host.remove();
    state.form = null;
    vi.restoreAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  }
});
