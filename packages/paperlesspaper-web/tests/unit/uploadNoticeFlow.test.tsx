// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
let root: ReturnType<typeof createRoot>;
function renderHook<T>(callback: () => T) {
  const result = { current: undefined as T };
  function Probe() {
    result.current = callback();
    return null;
  }
  root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  return { result, unmount: () => act(() => root.unmount()) };
}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  afterSubmit: null as any,
  upload: vi.fn(),
  update: vi.fn(),
  record: vi.fn(),
  devices: [] as any[],
  papers: [] as any[],
}));
vi.mock("helpers/useAccount", () => ({
  default: () => ({ user: { sub: "alice" } }),
}));
vi.mock("helpers/useUsers", () => ({
  useActiveUserDevice: () => ({ data: { id: "active", kind: "epd7" } }),
}));
vi.mock("helpers/uploadNotice", () => ({
  dismissUploadNotice: vi.fn(),
  recordSuccessfulUpload: mocks.record,
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({
    organization: "org",
    page: "calendar",
    entry: "active",
    paper: "new",
  }),
  useHistory: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" } }),
}));
vi.mock("helpers/useSettingsFormNew", () => ({
  default: (config: any) => {
    mocks.afterSubmit = config.afterSubmit;
    return {
      resultUpdateSingle: {},
      resultCreateSingle: {},
      form: { watch: () => undefined, setValue: vi.fn() },
    };
  },
}));
vi.mock("../../src/components/Epaper/Integrations/applications", () => ({
  default: [],
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useRotationList",
  () => ({ default: () => ({ portrait: {} }) }),
);
vi.mock("ducks/devices", () => ({
  devicesApi: { useGetAllDevicesQuery: () => ({ data: mocks.devices }) },
}));
vi.mock("ducks/ePaper/papersApi", () => ({
  papersApi: {
    useUploadSingleImageMutation: () => [mocks.upload],
    useUpdateSinglePapersMutation: () => [mocks.update],
    useGetSinglePapersQuery: () => ({}),
    useGetAllPapersQuery: () => ({ data: mocks.papers }),
  },
}));
import useIntegrationForm from "../../src/components/Epaper/Integrations/useIntegrationForm";
const saved = (kind = "image") => ({
  originalValues: { kind, dataDirect: new Blob(["image"]) },
  result: { data: { id: "paper", kind } },
});
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.devices = [];
  mocks.papers = [];
  mocks.upload.mockImplementation(() => ({ unwrap: async () => ({}) }));
  mocks.update.mockImplementation(() => ({ unwrap: async () => ({}) }));
});
afterEach(() => act(() => root?.unmount()));
it("counts once after all target uploads succeed, even after the editor has unmounted", async () => {
  let finish: () => void;
  mocks.upload.mockImplementationOnce(() => ({
    unwrap: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  }));
  const { result, unmount } = renderHook(() =>
    useIntegrationForm({ defaultValues: {} }),
  );
  act(() => result.current.setSelectedFrameIds(["target-a", "target-b"]));
  let sending: Promise<void>;
  await act(async () => {
    sending = mocks.afterSubmit(saved());
    await Promise.resolve();
  });
  expect(mocks.record).not.toHaveBeenCalled();
  unmount();
  await act(async () => {
    finish!();
    await sending!;
  });
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.record).toHaveBeenCalledExactlyOnceWith("alice", {
    organization: "org",
    frameIds: ["target-a", "target-b"],
    addedToSlideshow: false,
  });
});
it("does not count a failed transfer, and counts its successful retry once", async () => {
  renderHook(() => useIntegrationForm({ defaultValues: {} }));
  mocks.upload.mockImplementationOnce(() => ({
    unwrap: async () => {
      throw new Error("offline");
    },
  }));
  await act(() => mocks.afterSubmit(saved()));
  expect(mocks.record).not.toHaveBeenCalled();
  await act(() => mocks.afterSubmit(saved()));
  expect(mocks.record).toHaveBeenCalledTimes(1);
});
it("does not count failed paper creation, draft setup or integration changes", async () => {
  renderHook(() => useIntegrationForm({ defaultValues: {} }));
  await act(() =>
    mocks.afterSubmit({ originalValues: {}, result: { error: {} } }),
  );
  const draft = saved();
  draft.originalValues = {
    ...draft.originalValues,
    keepIntegrationOpenAfterDraft: true,
  } as any;
  await act(() => mocks.afterSubmit(draft));
  await act(() => mocks.afterSubmit(saved("website")));
  expect(mocks.record).not.toHaveBeenCalled();
});
it("marks slideshow-only uploads without promising an immediate image change", async () => {
  mocks.papers = [{ id: "slides", kind: "slides", meta: {} }];
  const { result } = renderHook(() =>
    useIntegrationForm({ defaultValues: {} }),
  );
  act(() => result.current.setSelectedSlideshowIds(["slides"]));
  await act(() => mocks.afterSubmit(saved()));
  expect(mocks.record).toHaveBeenCalledExactlyOnceWith("alice", {
    organization: "org",
    frameIds: [],
    addedToSlideshow: true,
  });
});
