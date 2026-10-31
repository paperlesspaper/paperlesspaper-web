import { beforeEach, describe, expect, it, vi } from "vitest";

const { page, context } = vi.hoisted(() => ({ context: { close: vi.fn() }, page: {
  setViewport: vi.fn(), goto: vi.fn(), evaluate: vi.fn(),
  waitForSelector: vi.fn(), screenshot: vi.fn(), close: vi.fn(),
  setBypassServiceWorker: vi.fn(), setRequestInterception: vi.fn(), on: vi.fn(),
} }));
vi.mock("puppeteer", () => ({ default: { launch: vi.fn(async () => ({
  on: vi.fn(), isConnected: () => true,
  createBrowserContext: async () => ({ ...context, newPage: async () => page }),
})) } }));
vi.mock("../../src/render/renderNetwork", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/render/renderNetwork")>(),
  startRenderProxy: async () => ({ url: "http://127.0.0.1:12345", close: vi.fn() }),
}));
vi.mock("../../src/render/adBlock.service", () => ({ adBlock: vi.fn() }));
import renderService from "../../src/render/render.service";

const render = () => renderService.generateImageFromUrl({
  url: "https://apps.paperlesspaper.de/weather", kind: "epd7",
  paper: { kind: "plugin" },
});

describe("failed page rendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    page.goto.mockResolvedValue({ status: () => 200 });
    page.evaluate
      .mockResolvedValueOnce({ loading: true, loaded: false })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ loading: true, loaded: false })
      .mockResolvedValueOnce({ status: "ready", hasErrorElement: false })
      .mockResolvedValueOnce(null);
    page.screenshot.mockResolvedValue(Buffer.from("rendered image"));
  });

  it.each([400, 401, 403, 404, 429, 500, 503, 599])("rejects HTTP %s before taking a screenshot and closes the page", async (status) => {
    page.goto.mockResolvedValue({ ok: () => false, status: () => status });
    const result = await render();
    expect(result.buffer).toBeNull();
    expect(result.diagnostics.error?.message).toContain(`HTTP ${status}`);
    expect(page.screenshot).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it.each([200, 204, 205, 206, 300, 302, 304, 307, 308, 399])("attempts rendering a ready document after HTTP %s", async (status) => {
    page.goto.mockResolvedValue({ status: () => status });
    const result = await render();
    expect(result.buffer?.toString()).toBe("rendered image");
    expect(result.diagnostics.outcome).toBe("success");
    expect(result.diagnostics.initPayloadSent).toBe(true);
    expect(page.waitForSelector).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("still rejects an unfinished render after HTTP 304", async () => {
    page.goto.mockResolvedValue({ ok: () => false, status: () => 304 });
    page.waitForSelector.mockRejectedValue(new Error("timeout"));
    const result = await render();
    expect(result.buffer).toBeNull();
    expect(result.diagnostics.readiness.outcome).toBe("timeout");
    expect(page.screenshot).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("does not save a loading screen when readiness times out", async () => {
    page.waitForSelector.mockRejectedValue(new Error("timeout"));
    const result = await render();
    expect(result.buffer).toBeNull();
    expect(result.diagnostics.readiness.outcome).toBe("timeout");
    expect(page.screenshot).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("still captures a page that finishes loading", async () => {
    const result = await render();
    expect(result.buffer?.toString()).toBe("rendered image");
    expect(result.diagnostics.outcome).toBe("success");
    expect(context.close).toHaveBeenCalledOnce();
  });
});
