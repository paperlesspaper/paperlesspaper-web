import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("helpers/headersWithAuth0Token", () => ({
  default: (headers: Headers) => headers,
}));
vi.mock("helpers/backendBaseUrl", () => ({
  buildPaperlesspaperBackendUrl: (path: string) =>
    `https://activation.test/${path}`,
}));
import { devicesApi } from "../../src/ducks/devices";

let store: ReturnType<typeof configureStore>;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  store = configureStore({
    reducer: { [devicesApi.reducerPath]: devicesApi.reducer },
    middleware: (getDefault) => getDefault().concat(devicesApi.middleware),
  });
});
afterEach(() => {
  store.dispatch(devicesApi.util.resetApiState());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const response = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const args = { id: "epd7-test", organization: "org-b" };

it("retries the actual preflight endpoint after an HTML 502 and preserves its organization", async () => {
  fetchMock
    .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
    .mockImplementation(async () =>
      response(200, { available: true, mode: "activation" })
    );
  const operation = store.dispatch(
    devicesApi.endpoints.getDeviceRegistrationStatus.initiate(args)
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect((await operation).data).toEqual({
    available: true,
    mode: "activation",
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [request] of fetchMock.mock.calls) {
    expect(request.method).toBe("GET");
    expect(new URL(request.url).searchParams.get("organization")).toBe("org-b");
  }
  operation.unsubscribe();
});
it.each([403, 502])("bounds preflight retry for HTTP %s", async (status) => {
  fetchMock.mockImplementation(async () =>
    response(status, { message: "upstream failure" })
  );
  const operation = store.dispatch(
    devicesApi.endpoints.getDeviceRegistrationStatus.initiate(args)
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect((await operation).error.status).toBe(status);
  expect(fetchMock).toHaveBeenCalledTimes(status === 403 ? 1 : 3);
  operation.unsubscribe();
});
it("never automatically replays the start mutation on a 502", async () => {
  fetchMock.mockImplementation(async () => response(502, {}));
  const operation = store.dispatch(
    devicesApi.endpoints.registerDevice.initiate({
      id: args.id,
      body: { organization: args.organization, enable: true },
    })
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect((await operation).error.status).toBe(502);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
