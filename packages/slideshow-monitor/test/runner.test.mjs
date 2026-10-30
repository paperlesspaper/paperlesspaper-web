import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  alertDecision,
  endpoint,
  fetchInventory,
  readState,
  run,
  saveState,
} from "../src/runner.mjs";

const config = {
  snapshotUrl: new URL("https://api.example/v1/monitor/slideshows"),
  apiToken: "token",
  maxPages: 3,
  intervalMs: 120_000,
  graceMs: 300_000,
  reminderMs: 3600_000,
  environment: "test",
  adminUrl: new URL("https://admin.example/runs"),
  adminToken: "admin",
};
const page = (results = [], nextCursor = null) => ({
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  results,
  nextCursor,
});
const row = (id) => ({
  deviceId: id,
  slideshowId: "show",
  configuration: "a",
  sourceIds: ["one"],
  selectedCount: 1,
  organizationMatches: true,
  telemetry: {},
  attempts: [],
});

test("scans every page and refuses duplicates or looping cursors", async () => {
  const seen = [];
  const rows = await fetchInventory(config, async (url) => {
    seen.push(String(url));
    return seen.length === 1
      ? page([row("one")], "a".repeat(24))
      : page([row("two")]);
  });
  assert.equal(rows.length, 2);
  assert.match(seen[1], /after=aaaa/);
  await assert.rejects(
    fetchInventory(config, async () => page([row("one")], "a".repeat(24)))
  );
  await assert.rejects(fetchInventory(config, async () => ({ results: [] })));
  await assert.rejects(
    fetchInventory(config, async () => ({ ...page(), checkedAt: "2020-01-01" }))
  );
});
test("a failed later page fails the entire scan", async () => {
  let calls = 0;
  await assert.rejects(
    fetchInventory(config, async () => {
      if (++calls === 1) return page([row("one")], "a".repeat(24));
      throw new Error("failure");
    })
  );
});
test("alert suppression, changed incidents, reminder and recovery", () => {
  const bad = {
    status: "failed",
    results: [{ deviceId: "a", code: "overdue", status: "failed" }],
  };
  const first = alertDecision({}, bad, 1000, 10000);
  assert.equal(first.event, null);
  const second = alertDecision(first.next, bad, 2000, 10000);
  assert.equal(second.event, "failure");
  assert.equal(alertDecision(second.next, bad, 3000, 10000).event, null);
  assert.equal(alertDecision(second.next, bad, 12000, 10000).event, "failure");
  assert.equal(
    alertDecision(second.next, { status: "watching" }, 4000, 10000).event,
    null
  );
  assert.equal(
    alertDecision(second.next, { status: "unknown", results: [] }, 4000, 10000)
      .event,
    "failure"
  );
  assert.equal(
    alertDecision(second.next, { status: "passed" }, 4000, 10000).event,
    "recovery"
  );
});
test("URLs reject credential embedding, non-HTTPS and redirects are disabled by the transport", () => {
  assert.throws(() => endpoint("https://user:secret@example.test", "test"));
  assert.throws(() => endpoint("http://example.test", "test"));
  assert.throws(() => endpoint("file:///secret", "test"));
});
test("failed scans preserve deadlines; dry-run never publishes or writes state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "slideshow-test-"));
  const stateFile = path.join(dir, "state.json");
  try {
    await saveState(stateFile, {
      version: 1,
      devices: { a: { dueAt: "pinned" } },
    });
    let calls = 0;
    const request = async (_url, options) => {
      calls++;
      if (!options.payload) throw new Error("offline");
      return {};
    };
    const dry = await run({ ...config, stateFile }, { request });
    assert.equal(dry.status, "error");
    assert.equal(calls, 1);
    assert.equal((await readState(stateFile)).devices.a.dueAt, "pinned");
    const published = await run(
      { ...config, stateFile },
      { publish: true, request }
    );
    assert.equal(published.summary.incomplete, true);
    assert.equal((await readState(stateFile)).devices.a.dueAt, "pinned");
    assert.equal(calls, 3);
    await writeFile(stateFile, "invalid");
    await assert.rejects(readState(stateFile));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("failed alert delivery does not mark notification as sent", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "slideshow-alert-"));
  const stateFile = path.join(dir, "state.json");
  try {
    await saveState(stateFile, {
      version: 1,
      devices: {},
      alert: { consecutive: 1 },
    });
    await assert.rejects(
      run(
        { ...config, stateFile, alertUrl: "https://alert.example/" },
        {
          publish: true,
          request: async (url, options) => {
            if (String(url).includes("alert.example"))
              throw new Error("offline");
            return options.payload ? {} : page();
          },
        }
      )
    );
    assert.equal((await readState(stateFile)).alert.sentAt, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
