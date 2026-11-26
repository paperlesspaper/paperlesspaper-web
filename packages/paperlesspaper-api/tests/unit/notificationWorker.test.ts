import { EventEmitter } from "node:events";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const { lookup, send, workers } = vi.hoisted(() => ({
  lookup: vi.fn(),
  send: vi.fn(),
  workers: new Map<string, (job: unknown) => Promise<unknown>>(),
}));

vi.mock("bullmq", () => ({
  Queue: EventEmitter,
  QueueEvents: EventEmitter,
  Worker: class extends EventEmitter {
    constructor(name: string, process: (job: unknown) => Promise<unknown>) {
      super();
      workers.set(name, process);
    }
  },
}));
vi.mock("@internetderdinge/api", () => ({
  accountsService: { getAccountById: lookup },
  config: { env: "production" },
}));
vi.mock("../../src/cronjobs/notifications.push", () => ({
  sendPushNotification: send,
}));
vi.mock("../../src/cronjobs/papers.cronjob", () => ({
  cronjobPapers: vi.fn(),
}));
vi.mock("../../src/cronjobs/deviceUpdateSchedule.cronjob", () => ({
  cronjobDeviceUpdateSchedule: vi.fn(),
}));
vi.mock("../../src/cronjobs/battery.cronjob", () => ({
  messageTitleBattery: (_entry: unknown, lng: string) => lng,
  messageBodyBattery: (_entry: unknown, lng: string) => lng,
}));

beforeAll(async () => {
  vi.stubEnv("REDIS_HOST", "localhost");
  vi.stubEnv("DISABLE_BULLMQ", "false");
  await import("../../src/cronjobs/bullmq.service");
});
afterAll(() => vi.unstubAllEnvs());

it.each([
  ["direct account", { app_metadata: { language: "nl" } }, "nl"],
  ["wrapped account", { data: { app_metadata: { language: "fr" } } }, "fr"],
  ["missing metadata", {}, "de"],
  ["missing account", null, "de"],
  ["invalid language", { app_metadata: { language: 42 } }, "de"],
])(
  "delivers the battery notification for %s",
  async (_case, response, expected) => {
    lookup.mockResolvedValueOnce(response);
    await workers.get("paperlesspaperCronjobs")!({
      name: "sendPushNotification",
      data: { kind: "battery", deviceNotifications: { user: "test-user" } },
    });
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lng: expected,
        title: expected,
        body: expected,
      })
    );
  }
);
