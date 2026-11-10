// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  foreground: true,
  server: vi.fn(),
}));

// Keep real RTK Query subscriptions, caching and endpoint definitions. Only the
// transport is replaced, so the server can change slides behind the open UI.
vi.mock("ducks/emptyApi", async () => {
  const { createApi } = await import("@reduxjs/toolkit/query/react");
  return {
    emptySplitApi: createApi({
      baseQuery: state.server,
      tagTypes: ["devices", "papers", "calendars"],
      endpoints: () => ({}),
    }),
  };
});
vi.mock("@paperlesspaper/helpers", () => ({ applicationsByKind: () => ({}) }));
vi.mock("@internetderdinge/web", () => ({
  capitalizeFirstLetter: (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1),
  devAppsBaseReplacement: (value: unknown) => value,
  resolvePossiblyRelativeUrl: (value: unknown) => value,
  useLocaleDate: () => ({}),
  useVisibility: () => state.foreground,
}));
vi.mock("@progressiveui/react", () => ({
  Callout: ({ children }: any) => <div role="alert">{children}</div>,
  Empty: () => null,
  InlineLoading: () => null,
}));
vi.mock("react-i18next", () => ({
  Trans: ({ children, i18nKey }: any) => i18nKey || children,
  useTranslation: () => ({ t: (value: string) => value }),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ kind: "device", entry: "device" }),
}));
vi.mock("helpers/formatDistanceShort", () => ({ default: () => "" }));
vi.mock("helpers/useCurrentUser", () => ({ useDebug: () => true }));
vi.mock("helpers/useUsers", async () => {
  const { devicesApi } = await import("ducks/devices");
  return {
    useActiveUserDevice: () => devicesApi.useGetSingleDevicesQuery("device"),
  };
});
vi.mock("components/ButtonRouter", () => ({ default: () => null }));
vi.mock("components/Calendar/NewEntryButton", () => ({ default: () => null }));
vi.mock("components/Settings/components/AddIcon", () => ({
  default: () => null,
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useEditor",
  () => ({ default: () => ({}) })
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
  default: () => null,
}));

import { emptySplitApi } from "ducks/emptyApi";
import { devicesApi } from "ducks/devices";
import { papersApi } from "ducks/ePaper/papersApi";
import PhotoFrame, {
  type PhotoFrameVariant,
} from "../../src/components/Epaper/Overview/PhotoFrame";

let root: Root;
let host: HTMLDivElement;
let store: ReturnType<typeof configureStore>;
let slide: string;
let status: {
  pictureSynced: boolean;
  fileVersion: number;
  lastReachableAgo: number;
  nextDeviceSync: number;
};
let variant: PhotoFrameVariant;
const paper = {
  id: "slideshow",
  kind: "slides",
  imageUpdatedAt: "2026-11-09T00:00:00Z",
};
const deviceRequests = () =>
  state.server.mock.calls.filter(
    ([request]) => request.url === "devices/device"
  );
const imageRequests = () =>
  state.server.mock.calls.filter(
    ([request]) => request.url === "papers/image/slideshow"
  );
const thumbnailRequests = () =>
  state.server.mock.calls.filter(
    ([request]) =>
      request.url === "devices/image/device/current-frame-thumbnail"
  );
const imageUrl = () =>
  host
    .querySelector('img[alt="Preview of the e-paper display"]')
    ?.getAttribute("src");

async function render() {
  await act(async () => {
    root.render(
      <Provider store={store}>
        <PhotoFrame paper={paper} variant={variant} />
      </Provider>
    );
  });
  await advance(20);
}

async function advance(ms: number) {
  // Let React commit between polling ticks and RTK's batched notifications.
  for (let remaining = ms; remaining > 0; remaining -= 1000) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(remaining, 1000));
    });
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}

function nextSlide() {
  slide = "B";
  status = {
    pictureSynced: true,
    fileVersion: Date.now(),
    lastReachableAgo: Date.now(),
    nextDeviceSync: Date.now() + 180_000,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.foreground = true;
  variant = "primary";
  slide = "A";
  status = {
    pictureSynced: true,
    fileVersion: Date.now() - 1000,
    lastReachableAgo: Date.now(),
    nextDeviceSync: Date.now() + 180_000,
  };
  state.server.mockReset();
  state.server.mockImplementation(async ({ url, body }) => {
    if (url === "devices/device")
      return {
        data: { id: "device", paper: "slideshow", deviceStatus: { ...status } },
      };
    if (url === "papers/image/slideshow")
      return {
        data: { signedUrl: `https://images.example/${slide}/${body.kind}` },
      };
    if (url === "devices/image/device/current-frame-thumbnail")
      return { data: { url: `https://images.example/${slide}/thumbnail.png` } };
    throw new Error(`Unexpected request: ${url}`);
  });
  store = configureStore({
    reducer: { [emptySplitApi.reducerPath]: emptySplitApi.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(emptySplitApi.middleware),
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers({ autoBatch: false }),
  });
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root.unmount();
    store.dispatch(emptySplitApi.util.resetApiState());
  });
  vi.useRealTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

it("discovers an automatic slide change after a confirmed sync and updates image and online status without reload", async () => {
  await render();
  expect(imageUrl()).toContain("/A/");
  await advance(180_000);
  nextSlide();
  await advance(25_000);
  expect(imageUrl()).toContain("/B/");
  expect(host.textContent).toContain("Current Image");
  expect(host.textContent).not.toContain("DEVICE_OFFLINE_SINCE");
  expect(
    host
      .querySelector('img[alt="Device-rendered e-paper image"]')
      ?.getAttribute("src")
  ).toContain("/B/");
});

it("refreshes all image queries on a new device version even when the slideshow ID is unchanged", async () => {
  await render();
  nextSlide();
  await act(async () => {
    await store.dispatch(
      devicesApi.endpoints.getSingleDevices.initiate("device", {
        subscribe: false,
        forceRefetch: true,
      })
    );
  });
  await advance(20);
  expect(imageUrl()).toContain("/B/");
  expect(thumbnailRequests()).toHaveLength(2);
  const imageCount = imageRequests().length;
  await advance(45_000);
  expect(imageRequests()).toHaveLength(imageCount);
});

it("pauses in the background, refreshes on return and stops polling on unmount", async () => {
  await render();
  state.foreground = false;
  await render();
  const before = deviceRequests().length;
  nextSlide();
  await advance(90_000);
  expect(deviceRequests()).toHaveLength(before);
  state.foreground = true;
  await render();
  await advance(2_000);
  expect(imageUrl()).toContain("/B/");
  act(() => root.unmount());
  root = createRoot(host);
  const after = deviceRequests().length;
  await advance(90_000);
  expect(deviceRequests()).toHaveLength(after);
});

it.each(["secondary", "preview"] as const)(
  "does not poll from a %s frame",
  async (value) => {
    variant = value;
    await render();
    const before = deviceRequests().length;
    await advance(90_000);
    expect(deviceRequests()).toHaveLength(before);
  }
);

it("keeps checking after a pending update has exceeded the five minute fast-poll window", async () => {
  status.pictureSynced = false;
  await render();
  await advance(310_000);
  const before = deviceRequests().length;
  nextSlide();
  await advance(25_000);
  expect(deviceRequests().length).toBeGreaterThan(before);
  expect(imageUrl()).toContain("/B/");
  expect(host.textContent).toContain("Current Image");
});

it("recovers on the next poll after a transient status request failure", async () => {
  await render();
  state.server.mockResolvedValueOnce({
    error: { status: 503, data: "temporarily unavailable" },
  });
  await advance(21_000);
  nextSlide();
  await advance(25_000);
  expect(imageUrl()).toContain("/B/");
});

it("refreshes the confirmed image and thumbnail even when the file version stays unchanged", async () => {
  status.pictureSynced = false;
  await render();
  const before = imageRequests().length;
  const thumbnailCount = thumbnailRequests().length;
  status.pictureSynced = true;
  // The image became available between preparation and device confirmation.
  slide = "B";
  await advance(7_000);
  expect(imageUrl()).toContain("/B/");
  expect(imageRequests().length).toBeGreaterThan(before);
  expect(thumbnailRequests().length).toBeGreaterThan(thumbnailCount);
  expect(host.textContent).toContain("Current Image");
});

it("waits for a slow request and does not restart polling if it completes in the background", async () => {
  await render();
  let finish: (value: any) => void = () => {};
  state.server.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await advance(21_000);
  const before = deviceRequests().length;
  await advance(45_000);
  expect(deviceRequests()).toHaveLength(before);
  state.foreground = false;
  await render();
  await act(async () => {
    finish({ data: { id: "device", deviceStatus: { ...status } } });
  });
  await advance(45_000);
  expect(deviceRequests()).toHaveLength(before);
});

it("shows the storage limit error from a background editor upload", async () => {
  await render();
  const server = state.server.getMockImplementation()!;
  const message = "Organization storage limit reached (500 MB). Delete pictures or replace them with smaller images.";
  state.server.mockImplementation(async (request, ...args) => {
    if (request.url === "papers/uploadSingleImage/slideshow") return { error: { status: 413, data: { message } } };
    return server(request, ...args);
  });
  await act(async () => {
    await store.dispatch(papersApi.endpoints.uploadSingleImage.initiate(
      { id: "slideshow", body: new FormData() },
      { fixedCacheKey: "upload-single-image" },
    ));
  });
  await advance(20);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(message);
});
