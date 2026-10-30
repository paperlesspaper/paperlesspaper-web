import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDevice, evaluateScan } from "../src/evaluate.mjs";

const now = Date.parse("2026-10-31T12:00:00Z");
const at = (minutes) => new Date(now + minutes * 60_000).toISOString();
const attempt = (overrides = {}) => ({
  attemptId: "a1",
  paperId: "show",
  sourcePaperId: "one",
  trigger: "cronjob-slideshow",
  status: "uploaded",
  startedAt: at(-3),
  finishedAt: at(-2),
  ...overrides,
});
const row = (overrides = {}) => ({
  deviceId: "device",
  deviceName: "epd7-test",
  organizationId: "org",
  slideshowId: "show",
  configuration: "config",
  organizationMatches: true,
  selectedCount: 2,
  sourceIds: ["one", "two"],
  intervalSeconds: 600,
  allowedWindows: null,
  scheduleError: false,
  telemetry: {
    nextDeviceSync: at(9),
    lastReachableAt: at(-1),
    fileVersion: at(-2),
    pictureSynced: true,
  },
  claim: {
    status: "completed",
    dueAt: at(-1),
    claimedAt: at(-4),
    completedAt: at(-2),
  },
  attempts: [attempt()],
  ...overrides,
});

test("confirms a correlated upload and reported retrieval, never the display", () => {
  const { result, state } = evaluateDevice(row(), undefined, now);
  assert.equal(result.status, "passed");
  assert.equal(result.display, "not-verified");
  assert.equal(state.dueAt, at(9));
});
test("does not mark a newly observed future cycle as passed", () => {
  assert.equal(
    evaluateDevice(row({ claim: null, attempts: [] }), undefined, now).result
      .status,
    "watching"
  );
});
test("does not move a missed deadline when the device reports a later sync", () => {
  const first = evaluateDevice(
    row({ claim: null, attempts: [] }),
    undefined,
    now
  );
  const later = evaluateDevice(
    row({ claim: null, attempts: [], telemetry: { nextDeviceSync: at(30) } }),
    first.state,
    now + 15 * 60_000
  );
  assert.equal(later.result.code, "preparation-overdue");
  assert.equal(later.state.dueAt, at(9));
});
test("same source on separate confirmed cycles is detected; retries are not new cycles", () => {
  const first = evaluateDevice(row(), undefined, now);
  const next = row({
    attempts: [
      attempt({ attemptId: "a2", startedAt: at(6), finishedAt: at(7) }),
    ],
    telemetry: {
      nextDeviceSync: at(19),
      lastReachableAt: at(10),
      fileVersion: at(7),
      pictureSynced: true,
    },
  });
  assert.equal(
    evaluateDevice(next, first.state, now + 10 * 60_000).result.code,
    "source-not-advancing"
  );
  assert.equal(
    evaluateDevice(row(), first.state, now + 60_000).result.code,
    "awaiting-cycle"
  );
});
test("single image is allowed, including deliberate identical image skips", () => {
  const r = row({
    sourceIds: ["one"],
    selectedCount: 1,
    attempts: [attempt({ status: "skipped", identical: true })],
    telemetry: {
      nextDeviceSync: at(9),
      lastReachableAt: at(-1),
      fileVersion: at(-90),
      pictureSynced: true,
    },
  });
  assert.equal(evaluateDevice(r, undefined, now).result.status, "passed");
});
test("arbitrary skipped and partial uploads never count as success", () => {
  for (const status of ["skipped", "partial", "failed", "started"]) {
    const r = row({ attempts: [attempt({ status })] });
    assert.notEqual(
      evaluateDevice(r, undefined, now + 10 * 60_000).result.status,
      "passed"
    );
  }
});
test("old file versions, unsynced devices and overwritten uploads do not confirm retrieval", () => {
  for (const telemetry of [
    { ...row().telemetry, fileVersion: at(-20) },
    { ...row().telemetry, pictureSynced: false },
    { ...row().telemetry, lastReachableAt: null },
  ])
    assert.equal(
      evaluateDevice(row({ telemetry }), undefined, now + 6 * 60_000).result
        .code,
      "retrieval-overdue"
    );
  assert.equal(
    evaluateDevice(
      row({
        attempts: [
          attempt({ attemptId: "other", trigger: "manual", startedAt: at(-1) }),
          attempt(),
        ],
      }),
      undefined,
      now + 6 * 60_000
    ).result.code,
    "retrieval-overdue"
  );
});
test("missing and invalid telemetry is unknown, not a green result", () => {
  assert.equal(
    evaluateDevice(
      row({ claim: null, attempts: [], telemetry: {} }),
      undefined,
      now
    ).result.status,
    "unknown"
  );
});
test("stale claims and empty or missing slideshow sources are explicit failures", () => {
  assert.equal(
    evaluateDevice(
      row({ claim: { status: "processing", claimedAt: at(-16) } }),
      undefined,
      now
    ).result.code,
    "claim-stuck"
  );
  assert.equal(
    evaluateDevice(row({ sourceIds: [] }), undefined, now).result.code,
    "no-valid-slides"
  );
  assert.equal(
    evaluateDevice(row({ sourceIds: ["one"] }), undefined, now).result.code,
    "missing-slides"
  );
  assert.equal(
    evaluateDevice(row({ organizationMatches: false }), undefined, now).result
      .code,
    "organization-mismatch"
  );
});
test("nighttime schedule defers an expectation; absent windows are unknown", () => {
  assert.equal(
    evaluateDevice(
      row({ attempts: [], allowedWindows: [{ start: at(60), end: at(120) }] }),
      undefined,
      now
    ).state.dueAt,
    at(60)
  );
  assert.equal(
    evaluateDevice(row({ allowedWindows: [] }), undefined, now).result.status,
    "unknown"
  );
});
test("configuration changes reset expectations and persisted state survives serialization", () => {
  const first = evaluateDevice(row(), undefined, now);
  const restored = JSON.parse(JSON.stringify(first.state));
  assert.equal(
    evaluateDevice(row(), restored, now + 60_000).state.dueAt,
    at(9)
  );
  const changed = evaluateDevice(
    row({ configuration: "changed", claim: null, attempts: [] }),
    restored,
    now
  );
  assert.equal(changed.result.status, "watching");
});
test("zero devices and partial telemetry never produce an all-healthy scan", () => {
  assert.equal(evaluateScan([], {}, now).summary.status, "unknown");
  assert.equal(
    evaluateScan(
      [row(), row({ deviceId: "b", claim: null, telemetry: {}, attempts: [] })],
      {},
      now
    ).summary.status,
    "unknown"
  );
});
