import { afterEach, expect, it, vi } from "vitest";

vi.mock("@internetderdinge/api", async () => ({
  ApiError: (await import("@internetderdinge/api/src/utils/ApiError")).default,
}));
import { fetchEditableImage } from "../../src/papers/fetchEditableImage";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("loads editable JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ objects: [] })));
  await expect(fetchEditableImage("https://storage.test/image")).resolves.toEqual({ objects: [] });
});

it.each([404, 403, 500, 503])("handles storage HTTP %s without parsing XML or exposing the signed URL", async (status) => {
  const json = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json, body: { cancel } }));
  await expect(fetchEditableImage("https://storage.test/private?token=secret")).rejects.toMatchObject({
    statusCode: status === 404 ? 404 : 502,
    message: status === 404 ? "Editable image data was not found" : "Could not retrieve editable image data",
  });
  expect(json).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});

it("sanitizes malformed JSON and network errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<Error>secret</Error>")));
  await expect(fetchEditableImage("https://storage.test/image")).rejects.toMatchObject({ statusCode: 502, message: "Could not retrieve editable image data" });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("URL containing secret")));
  await expect(fetchEditableImage("https://storage.test/image")).rejects.toMatchObject({ statusCode: 502, message: "Could not retrieve editable image data" });
});

it.each([false, true])("bounds both request and body download (headers received: %s)", async (headersReceived) => {
  vi.useFakeTimers();
  let signal: AbortSignal;
  const hanging = new Promise(() => {});
  vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options) => {
    signal = options.signal;
    return headersReceived ? Promise.resolve({ ok: true, json: () => hanging }) : hanging;
  }));
  const result = expect(fetchEditableImage("https://storage.test/image")).rejects.toMatchObject({ statusCode: 504 });
  await vi.advanceTimersByTimeAsync(20_000);
  await result;
  expect(signal!.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
