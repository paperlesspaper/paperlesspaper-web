// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  params: {} as any,
  device: {} as any,
  papers: {} as any,
  single: {} as any,
  defaults: {} as any,
}));
vi.mock("react-router-dom", () => ({
  useParams: () => state.params,
  useHistory: () => ({}),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" } }),
}));
vi.mock("helpers/useUsers", () => ({
  useActiveUserDevice: () => state.device,
}));
vi.mock("helpers/useQs", () => ({ default: () => ({}) }));
vi.mock("ducks/devices", () => ({
  devicesApi: { useGetAllDevicesQuery: () => ({}) },
}));
vi.mock("ducks/ePaper/papersApi", () => ({
  papersApi: {
    name: "papers",
    useGetAllPapersQuery: (args: any) =>
      args.organizationId ? {} : state.papers,
    useGetSinglePapersQuery: () => state.single,
    useCreateSinglePapersMutation: () => [vi.fn(), {}],
    useUpdateSinglePapersMutation: () => [vi.fn(), {}],
    useDeleteSinglePapersMutation: () => [vi.fn(), {}],
    useUploadSingleImageMutation: () => [vi.fn(), {}],
  },
}));
vi.mock("../../src/components/Epaper/Integrations/applications", () => ({
  default: [],
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useRotationList",
  () => ({
    default: () => ({
      portrait: { name: "portrait", width: 480, height: 800 },
      landscape: { name: "landscape", width: 800, height: 480 },
    }),
  })
);
import useIntegrationForm from "../../src/components/Epaper/Integrations/useIntegrationForm";

const paper = (orientation: string) => ({ meta: { orientation } });
let root: ReturnType<typeof createRoot>;
const renderForm = () => {
  const result = {
    current: null as ReturnType<typeof useIntegrationForm> | null,
  };
  function Form() {
    result.current = useIntegrationForm({ defaultValues: state.defaults });
    return null;
  }
  const rerender = () => act(() => root.render(<Form />));
  rerender();
  return { result, rerender };
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement("div"));
  state.params = {
    organization: "org",
    kind: "device",
    entry: "frame",
    paper: "new",
    paperKind: "image",
  };
  state.device = { data: { id: "frame", kind: "openpaper13" } };
  state.papers = { isLoading: true };
  state.single = {};
  state.defaults = { kind: "image" };
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

it("waits for uncached papers and initializes a new photo in landscape without marking it dirty", () => {
  const { result, rerender } = renderForm();
  expect(result.current.size.name).toBe("portrait");
  const papers = [paper("landscape")];
  state.papers = { data: papers, currentData: papers };
  rerender();
  expect(result.current.size.name).toBe("landscape");
  expect(result.current.isInitializingOrientation).toBe(false);
  expect(result.current.form.formState.isDirty).toBe(false);
  act(() =>
    result.current.form.setValue("meta.orientation", "portrait", {
      shouldDirty: true,
    })
  );
  expect(result.current.form.getFieldState("meta.orientation").isDirty).toBe(
    true
  );
  act(() =>
    result.current.form.setValue("meta.orientation", "landscape", {
      shouldDirty: true,
    })
  );
  expect(result.current.form.getFieldState("meta.orientation").isDirty).toBe(
    false
  );
});

it("waits for the frame before requesting its previous orientation", () => {
  state.device = { isLoading: true };
  const { result, rerender } = renderForm();
  expect(result.current.isInitializingOrientation).toBe(true);
  state.device = { data: { id: "frame", kind: "openpaper13" } };
  rerender();
  expect(result.current.isInitializingOrientation).toBe(true);
  state.papers = { currentData: [paper("landscape")] };
  rerender();
  expect(result.current.size.name).toBe("landscape");
  expect(result.current.isInitializingOrientation).toBe(false);
});

it("uses the device preference without waiting for previous papers", () => {
  state.device.data.meta = { orientation: "landscape" };
  const { result } = renderForm();
  expect(result.current.size.name).toBe("landscape");
  expect(result.current.isInitializingOrientation).toBe(false);
});

it("prefers the device setting over a previous paper", () => {
  state.device.data.meta = { orientation: "landscape" };
  state.papers = { currentData: [paper("portrait")] };
  const { result } = renderForm();
  expect(result.current.size.name).toBe("landscape");
});

it("preserves an explicitly restored batch editor orientation", () => {
  state.device.data.meta = { orientation: "portrait" };
  state.defaults.meta = { orientation: "landscape" };
  const { result } = renderForm();
  expect(result.current.size.name).toBe("landscape");
  expect(result.current.isInitializingOrientation).toBe(false);
});

it("does not use stale papers from the previous frame", () => {
  state.papers = {
    data: [paper("portrait")],
    currentData: undefined,
    isFetching: true,
  };
  const { result, rerender } = renderForm();
  expect(result.current.isInitializingOrientation).toBe(true);
  state.papers = { currentData: [paper("landscape")] };
  rerender();
  expect(result.current.size.name).toBe("landscape");
});

it("does not initialize from stale device data when switching frames", () => {
  state.device = {
    data: { id: "previous-frame", meta: { orientation: "portrait" } },
    isFetching: true,
  };
  const { result, rerender } = renderForm();
  expect(result.current.isInitializingOrientation).toBe(true);
  state.device = { data: { id: "frame", meta: { orientation: "landscape" } } };
  rerender();
  expect(result.current.size.name).toBe("landscape");
});

it("does not overwrite a manual orientation change while defaults are loading", () => {
  const { result, rerender } = renderForm();
  act(() =>
    result.current.form.setValue("meta.orientation", "landscape", {
      shouldDirty: true,
    })
  );
  state.papers = { currentData: [paper("portrait")] };
  rerender();
  expect(result.current.size.name).toBe("landscape");
});

it("does not rotate an initialized editor on a background refresh", () => {
  state.papers = { currentData: [paper("landscape")] };
  const { result, rerender } = renderForm();
  state.papers = { currentData: [paper("portrait")] };
  rerender();
  expect(result.current.size.name).toBe("landscape");
  act(() =>
    result.current.form.setValue("meta.orientation", "portrait", {
      shouldDirty: true,
    })
  );
  state.papers = { currentData: [paper("landscape")] };
  rerender();
  expect(result.current.size.name).toBe("portrait");
});

it("keeps an existing paper's orientation even if its frame is landscape", () => {
  state.params.paper = "saved-paper";
  state.device.data.meta = { orientation: "landscape" };
  state.single = {
    data: { id: "saved-paper", ...paper("portrait") },
    isSuccess: true,
  };
  const { result } = renderForm();
  expect(result.current.size.name).toBe("portrait");
  expect(result.current.isInitializingOrientation).toBe(false);
});

it("initializes again after navigating from a saved paper back to a new one", () => {
  state.papers = { currentData: [paper("landscape")] };
  const { result, rerender } = renderForm();
  state.params.paper = "saved-paper";
  state.single = {
    data: { id: "saved-paper", ...paper("portrait") },
    isSuccess: true,
  };
  rerender();
  state.params.paper = "new";
  state.single = {};
  state.papers = { isLoading: true };
  rerender();
  expect(result.current.isInitializingOrientation).toBe(true);
  state.papers = { currentData: [paper("landscape")] };
  rerender();
  expect(result.current.size.name).toBe("landscape");
  expect(result.current.isInitializingOrientation).toBe(false);
});

it.each([
  { currentData: [] },
  { isError: true },
  { currentData: [paper("invalid")] },
])(
  "falls back to portrait when there is no usable previous orientation: %j",
  (query) => {
    state.papers = query;
    const { result } = renderForm();
    expect(result.current.isInitializingOrientation).toBe(false);
    expect(result.current.size.name).toBe("portrait");
  }
);
