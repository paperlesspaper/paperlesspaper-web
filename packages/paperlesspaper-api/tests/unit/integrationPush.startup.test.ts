import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  startPush: vi.fn(),
  startCron: vi.fn(),
  logError: vi.fn(),
  listen: vi.fn(),
  rendererReady: vi.fn(),
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("mongoose", () => ({ default: { connect: async () => undefined } }));
vi.mock("../../src/app", () => ({ default: { listen: m.listen } }));
vi.mock("../../src/render/renderReadiness", () => ({
  assertProductionRendererReady: m.rendererReady,
}));
vi.mock("@internetderdinge/api", () => ({
  config: { mongoose: { url: "mock", options: {} }, port: 3000 },
  logger: { info: vi.fn(), error: m.logError, warn: vi.fn() },
  initI18n: vi.fn(),
  initDeviceList: vi.fn(),
}));
vi.mock("@paperlesspaper/helpers", () => ({ deviceList: [] }));
vi.mock("../../src/integrationPush/worker.js", () => ({
  startIntegrationPushWorker: m.startPush,
}));
vi.mock("../../src/cronjobs/bullmq.start.service", () => ({
  startCronjobs: m.startCron,
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  // Import the real entry point without adding process-wide signal handlers.
  vi.spyOn(process, "on").mockReturnValue(process);
  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
});
afterEach(() => vi.restoreAllMocks());

it("initializes existing host jobs even when integration startup fails", async () => {
  m.startPush.mockRejectedValue(new Error("Index initialization failed"));
  await import("../../src/index");
  await vi.waitFor(() => {
    expect(m.startCron).toHaveBeenCalledOnce();
    expect(m.logError).toHaveBeenCalledWith(
      "Failed to initialize integration processing",
      expect.any(Error)
    );
  });
  expect(m.listen).toHaveBeenCalledOnce();
});

it("does not wait for a stalled integration worker before initializing existing jobs", async () => {
  m.startPush.mockImplementation(() => new Promise(() => {}));
  await import("../../src/index");
  await vi.waitFor(() => {
    expect(m.startPush).toHaveBeenCalledOnce();
    expect(m.startCron).toHaveBeenCalledOnce();
  });
});

it("does not accept traffic when renderer preflight fails", async () => {
  m.rendererReady.mockRejectedValue(new Error("Renderer unreachable"));
  await import("../../src/index");
  await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));
  expect(m.listen).not.toHaveBeenCalled();
  expect(m.startCron).not.toHaveBeenCalled();
});

it("does not accept traffic when recurring schedules cannot be restored", async () => {
  m.startCron.mockRejectedValue(new Error("Redis unavailable"));
  await import("../../src/index");
  await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));
  expect(m.listen).not.toHaveBeenCalled();
});

it("waits for renderer and scheduler readiness before accepting traffic", async () => {
  let ready!: () => void;
  m.startCron.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      })
  );
  await import("../../src/index");
  await vi.waitFor(() => expect(m.startCron).toHaveBeenCalledOnce());
  expect(m.rendererReady).toHaveBeenCalledOnce();
  expect(m.listen).not.toHaveBeenCalled();
  ready();
  await vi.waitFor(() => expect(m.listen).toHaveBeenCalledOnce());
});
