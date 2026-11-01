import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { requestJson, run, readState } from "../src/runner.mjs";
import { acquireLock } from "../src/lock.mjs";

test("HTTP roundtrip: fleet fault, persisted deadline, recovery and Admin publication", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "monitor-http-"));
  const reports = [];
  const alerts = [];
  const now = Date.now();
  const at = (seconds) => new Date(now + seconds * 1000).toISOString();
  let recovered = false;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/unexpected" });
      res.end();
      return;
    }
    if (req.url === "/snapshot") {
      assert.equal(req.headers.authorization, "Bearer read-only");
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          schemaVersion: 1,
          checkedAt: new Date().toISOString(),
          nextCursor: null,
          results: [
            {
              deviceId: "device",
              deviceName: "frame",
              slideshowId: "show",
              configuration: "unchanged",
              organizationMatches: true,
              sourceIds: ["one"],
              selectedCount: 1,
              telemetry: {
                nextDeviceSync: recovered ? at(600) : at(-600),
                fileVersion: at(-20),
                lastReachableAt: at(-5),
                pictureSynced: recovered,
              },
              attempts: recovered
                ? [
                    {
                      attemptId: "fixed",
                      paperId: "show",
                      sourcePaperId: "one",
                      trigger: "cronjob-slideshow",
                      startedAt: at(-30),
                      finishedAt: at(-10),
                      status: "uploaded",
                    },
                  ]
                : [],
            },
          ],
        })
      );
    } else {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (req.url === "/admin") {
        assert.equal(req.headers.authorization, "Bearer ingest");
        reports.push(body);
      } else if (req.url === "/alert") alerts.push(body);
      else assert.fail("Unexpected request");
      res.writeHead(204);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = {
    snapshotUrl: `${base}/snapshot`,
    apiToken: "read-only",
    adminUrl: `${base}/admin`,
    adminToken: "ingest",
    alertUrl: `${base}/alert`,
    stateFile: path.join(directory, "state.json"),
    environment: "test",
    maxPages: 2,
    intervalMs: 120_000,
    graceMs: 300_000,
    reminderMs: 3600_000,
  };
  try {
    const release = await acquireLock(config.stateFile);
    await assert.rejects(acquireLock(config.stateFile));
    await release();
    assert.equal((await run(config, { publish: true })).status, "failed");
    assert.equal((await run(config, { publish: true })).status, "failed");
    recovered = true;
    assert.equal((await run(config, { publish: true })).status, "passed");
    assert.deepEqual(
      reports.map((r) => r.status),
      ["failed", "failed", "passed"]
    );
    assert.deepEqual(
      alerts.map((r) => r.event),
      ["failure", "recovery"]
    );
    assert.equal(
      (await readState(config.stateFile)).devices.device.dueAt,
      at(600)
    );
    await assert.rejects(
      requestJson(`${base}/redirect`, { token: "must-not-forward" })
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
