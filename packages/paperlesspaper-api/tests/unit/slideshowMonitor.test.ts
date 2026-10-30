import { beforeEach, afterEach, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  sources: vi.fn(),
  logs: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@internetderdinge/api", () => ({
  Device: { aggregate: () => ({ option: mocks.aggregate }) },
  getAuth0Token: mocks.token,
}));
vi.mock("../../src/papers/papers.model", () => ({
  default: {
    collection: { name: "papers" },
    find: () => ({
      select: () => ({ lean: () => ({ maxTimeMS: mocks.sources }) }),
    }),
  },
}));
vi.mock("../../src/devicesLogs/devicesLogs.model", () => ({
  default: {
    find: () => ({
      sort: () => ({
        limit: () => ({
          select: () => ({ lean: () => ({ maxTimeMS: mocks.logs }) }),
        }),
      }),
    }),
  },
}));
vi.mock("../../src/cronjobs/deviceUpdateSchedule.cronjob", () => ({
  getAllowedIntervals: () => [],
}));

import {
  authorizedMonitor,
  safeAttempt,
  safeTelemetry,
  slideshowSnapshot,
} from "../../src/slideshowMonitor/snapshot";
import router from "../../src/slideshowMonitor/route";
const secret = "s".repeat(40);
const app = express().use(router);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SLIDESHOW_MONITOR_TOKEN", secret);
  vi.stubEnv("IOT_API_URL_EPAPER", "https://iot.example/");
  mocks.aggregate.mockResolvedValue([]);
  mocks.sources.mockResolvedValue([{ _id: "a".repeat(24) }]);
  mocks.logs.mockResolvedValue([]);
  mocks.token.mockResolvedValue("upstream-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("fails closed for absent or weak secrets and wrong credentials", () => {
  expect(authorizedMonitor(`Bearer ${secret}`)).toBe(true);
  expect(authorizedMonitor(`Bearer wrong`)).toBe(false);
  expect(authorizedMonitor(undefined)).toBe(false);
  expect(authorizedMonitor("Bearer short", "short")).toBe(false);
  expect(authorizedMonitor(`Bearer ${secret}`, "")).toBe(false);
});
it("exposes only normalized evidence, never raw status, settings or error bodies", () => {
  expect(
    safeTelemetry({
      nextDeviceSync: "1793448000",
      fileVersion: 1793448000000,
      pictureSynced: true,
      password: "hidden",
      lastReachableAgo: null,
    })
  ).toEqual({
    nextDeviceSync: "2026-10-31T12:00:00.000Z",
    fileVersion: "2026-10-31T12:00:00.000Z",
    lastReachableAt: null,
    pictureSynced: true,
  });
  const serialized = JSON.stringify(
    safeAttempt({
      attemptId: "a",
      trigger: "cronjob-slideshow",
      status: "skipped",
      reason: "similarity-threshold-met",
      triggerMetadata: { sourcePaperId: "source", token: "secret" },
      iotResponse: { token: "secret" },
      failures: [{ url: "secret" }],
    })
  );
  expect(serialized).not.toContain("secret");
  expect(JSON.parse(serialized).identical).toBe(true);
});
it("protects the fleet inventory and validates pagination before touching the database", async () => {
  expect((await request(app).get("/slideshows")).status).toBe(401);
  expect(
    (
      await request(app)
        .get("/slideshows?after=bad")
        .set("Authorization", `Bearer ${secret}`)
    ).status
  ).toBe(400);
  expect(mocks.aggregate).not.toHaveBeenCalled();
  const response = await request(app)
    .get("/slideshows")
    .set("Authorization", `Bearer ${secret}`);
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    schemaVersion: 1,
    results: [],
    nextCursor: null,
  });
  expect(response.headers["cache-control"]).toBe("no-store");
});
it("returns errors as errors instead of an empty healthy inventory", async () => {
  mocks.aggregate.mockRejectedValue(new Error("database-password-secret"));
  const response = await request(app)
    .get("/slideshows")
    .set("Authorization", `Bearer ${secret}`);
  expect(response.status).toBe(503);
  expect(response.text).not.toContain("secret");
});
it("pages assigned frames and reports upstream failure as unknown telemetry", async () => {
  mocks.aggregate.mockResolvedValue(
    Array.from({ length: 21 }, (_, i) => ({
      _id: i.toString(16).padStart(24, "0"),
      deviceId: `epd7-${i}`,
      paper: "b".repeat(24),
      organization: "org",
      meta: { sleepTime: 600 },
      slideshow: {
        organization: "org",
        meta: { selectedPapers: { ["a".repeat(24)]: true } },
      },
    }))
  );
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret")));
  const result = await slideshowSnapshot();
  expect(result.results).toHaveLength(20);
  expect(result.nextCursor).toBe((19).toString(16).padStart(24, "0"));
  expect(result.results[0].telemetry.nextDeviceSync).toBe(null);
  expect(result.results[0].sourceIds).toEqual(["a".repeat(24)]);
  expect(JSON.stringify(result)).not.toContain("secret");
});
