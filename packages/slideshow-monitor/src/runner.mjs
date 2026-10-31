import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { evaluateScan } from "./evaluate.mjs";

export function endpoint(value, name, allowHttp = false) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:"))
  ) {
    throw new Error(`${name} requires HTTPS without embedded credentials`);
  }
  return url;
}

export async function requestJson(
  url,
  { token, payload, timeout = 90_000 } = {}
) {
  const response = await fetch(url, {
    method: payload ? "POST" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // Do not log upstream bodies: they can contain secrets and customer information.
  return response.status === 204 ||
    (payload && !response.headers.get("content-type")?.includes("json"))
    ? null
    : response.json();
}

export async function readState(file) {
  try {
    const state = JSON.parse(await readFile(file, "utf8"));
    if (
      state.version !== 1 ||
      !state.devices ||
      typeof state.devices !== "object"
    )
      throw new Error("Invalid monitor state");
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, devices: {} };
    throw new Error(
      "Cannot read monitor state; refusing to discard monitoring history"
    );
  }
}

export async function saveState(file, state) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
  await rename(temporary, file);
}

export async function fetchInventory(config, request = requestJson) {
  const deadline = Date.now() + (config.scanTimeoutMs || 300_000);
  const rows = [];
  const cursors = new Set();
  const ids = new Set();
  let after;
  for (let page = 0; page < config.maxPages; page++) {
    const url = new URL(config.snapshotUrl);
    if (after) url.searchParams.set("after", after);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Scan deadline exceeded");
    const data = await request(url, {
      token: config.apiToken,
      timeout: Math.min(120_000, remaining),
    });
    if (
      data?.schemaVersion !== 1 ||
      !Array.isArray(data.results) ||
      !Object.hasOwn(data, "nextCursor") ||
      !Number.isFinite(Date.parse(data.checkedAt)) ||
      Math.abs(Date.now() - Date.parse(data.checkedAt)) > 5 * 60_000
    )
      throw new Error("Invalid or stale snapshot");
    for (const row of data.results) {
      if (
        !row?.deviceId ||
        !row.slideshowId ||
        !row.configuration ||
        !Array.isArray(row.sourceIds) ||
        !Array.isArray(row.attempts) ||
        !row.telemetry ||
        typeof row.organizationMatches !== "boolean" ||
        ids.has(row.deviceId)
      )
        throw new Error("Invalid or duplicate device snapshot");
      ids.add(row.deviceId);
      rows.push(row);
    }
    if (data.nextCursor === null) return rows;
    if (
      typeof data.nextCursor !== "string" ||
      !/^[a-f\d]{24}$/i.test(data.nextCursor) ||
      cursors.has(data.nextCursor)
    ) {
      throw new Error("Invalid snapshot pagination");
    }
    after = data.nextCursor;
    cursors.add(after);
  }
  throw new Error("Snapshot page limit exceeded; scan incomplete");
}

export function alertDecision(previous = {}, summary, now, reminderMs) {
  const bad = ["failed", "error", "unknown"].includes(summary.status);
  const fingerprint =
    JSON.stringify(
      (summary.results || [])
        .filter((r) => ["failed", "unknown"].includes(r.status))
        .map((r) => `${r.deviceId}:${r.code}`)
        .sort()
    ) + (summary.status === "error" ? ":scan-error" : "");
  const alert = {
    ...previous,
    consecutive: bad ? (previous.consecutive || 0) + 1 : 0,
  };
  if (
    bad &&
    alert.consecutive >= 2 &&
    (!previous.open ||
      previous.fingerprint !== fingerprint ||
      now - (previous.sentAt || 0) >= reminderMs)
  ) {
    return {
      event: "failure",
      next: { ...alert, open: true, fingerprint, sentAt: now },
    };
  }
  if (summary.status === "passed" && previous.open)
    return {
      event: "recovery",
      next: { ...alert, open: false, fingerprint: null, sentAt: now },
    };
  return { event: null, next: alert };
}

export async function run(
  config,
  { publish = false, request = requestJson } = {}
) {
  const startedAt = new Date().toISOString();
  const previous = await readState(config.stateFile);
  let evaluation;
  try {
    evaluation = evaluateScan(
      await fetchInventory(config, request),
      previous.devices,
      Date.now(),
      { graceMs: config.graceMs }
    );
  } catch {
    evaluation = {
      devices: previous.devices,
      summary: {
        status: "error",
        checkedAt: new Date().toISOString(),
        reason:
          "Vollständige Geräteprüfung nicht möglich (API, Authentifizierung oder Pagination).",
        results: [],
        counts: { total: 0, passed: 0, failed: 0, unknown: 0, watching: 0 },
        incomplete: true,
      },
    };
  }
  const finishedAt = new Date().toISOString();
  const payload = {
    externalId: `paperlesspaper-slideshows-${randomUUID()}`,
    monitorName: "paperlesspaper-slideshows",
    environment: config.environment,
    status: evaluation.summary.status,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    triggerSource: "independent-monitor",
    summary: {
      ...evaluation.summary,
      nextCheckAt: new Date(Date.now() + config.intervalMs).toISOString(),
      staleAfterSeconds: Math.max(
        360,
        Math.ceil(
          ((config.scanTimeoutMs || 300_000) + config.intervalMs * 2) / 1000
        )
      ),
    },
    artifacts: {},
    createdResources: [],
  };
  if (!publish) return payload;
  // Persist pinned deadlines even when the report destination is down.
  const next = { ...previous, version: 1, devices: evaluation.devices };
  await saveState(config.stateFile, next);
  await request(config.adminUrl, {
    token: config.adminToken,
    payload,
    timeout: 30_000,
  });
  const decision = alertDecision(
    previous.alert,
    payload.summary,
    Date.now(),
    config.reminderMs
  );
  if (decision.event && config.alertUrl) {
    await request(config.alertUrl, {
      token: config.alertToken,
      timeout: 15_000,
      payload: {
        eventId: payload.externalId,
        event: decision.event,
        monitor: payload.monitorName,
        environment: payload.environment,
        checkedAt: finishedAt,
        summary: payload.summary,
      },
    });
    next.alert = decision.next;
  } else if (!decision.event) next.alert = decision.next;
  else
    next.alert = { ...previous.alert, consecutive: decision.next.consecutive };
  await saveState(config.stateFile, { ...next, lastCompletedAt: finishedAt });
  if (config.heartbeatUrl) {
    const response = await fetch(config.heartbeatUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Heartbeat delivery failed");
  }
  return payload;
}
