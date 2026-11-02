const MINUTE = 60_000;
const time = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? Date.parse(value)
    : null;
const iso = (value) => (value == null ? null : new Date(value).toISOString());

/** A green result only covers server preparation and reported retrieval, never the physical display. */
export function evaluateDevice(
  row,
  previous,
  now,
  { graceMs = 5 * MINUTE } = {}
) {
  const state =
    previous?.configuration === row.configuration
      ? { ...previous }
      : {
          configuration: row.configuration,
          firstObservedAt: iso(now),
          dueAt: null,
        };
  const telemetry = row.telemetry || {};
  // Supplied by the API's scheduling policy. Older API versions retain 5 min.
  const preparationAheadMs = [300, 600, 900, 1500].includes(
    row.preparationAheadSeconds,
  )
    ? row.preparationAheadSeconds * 1000
    : 5 * MINUTE;
  const nextSync = time(telemetry.nextDeviceSync);
  const claimDue = time(row.claim?.dueAt);
  let due = time(state.dueAt) ?? nextSync;
  if (
    !previous &&
    !state.dueAt &&
    claimDue !== null &&
    (due === null || claimDue < due)
  )
    due = claimDue;
  const result = {
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    organizationId: row.organizationId,
    slideshowId: row.slideshowId,
    status: "unknown",
    code: "telemetry-missing",
    reason: "Gerätestatus oder nächster Abruf fehlt.",
    expectedAt: iso(due),
    preparation: "unknown",
    retrieval: "unknown",
    display: "not-verified",
    lastReachableAt: telemetry.lastReachableAt,
    lastSuccessfulCycleAt: state.lastSuccessfulCycleAt || null,
  };
  const finish = (status, code, reason) => {
    state.dueAt = iso(due);
    return { result: { ...result, status, code, reason }, state };
  };
  if (!row.organizationMatches)
    return finish(
      "failed",
      "organization-mismatch",
      "Diashow und Rahmen gehören nicht zur selben Organisation."
    );
  if (!row.sourceIds?.length)
    return finish(
      "failed",
      "no-valid-slides",
      "Die Diashow enthält keine gültigen Bilder."
    );
  if (row.selectedCount !== row.sourceIds.length)
    return finish(
      "failed",
      "missing-slides",
      "Ausgewählte Bilder fehlen oder sind nicht zugänglich."
    );
  if (row.scheduleError)
    return finish(
      "unknown",
      "schedule-invalid",
      "Der Aktualisierungszeitplan konnte nicht ausgewertet werden."
    );
  if (
    row.claim?.status === "processing" &&
    time(row.claim.claimedAt) !== null &&
    now - time(row.claim.claimedAt) > 15 * MINUTE
  ) {
    return finish(
      "failed",
      "claim-stuck",
      "Die Verarbeitung ist seit mehr als 15 Minuten reserviert."
    );
  }
  // Planned quiet periods do not count as missed transitions. Never silently ignore a broken schedule.
  if (Array.isArray(row.allowedWindows)) {
    if (!row.allowedWindows.length)
      return finish(
        "unknown",
        "no-scheduled-window",
        "Kein erlaubtes Aktualisierungsfenster in den nächsten sieben Tagen."
      );
    if (
      due !== null &&
      !row.allowedWindows.some((w) => time(w.start) <= due && time(w.end) > due)
    ) {
      const window = row.allowedWindows.find((w) => time(w.start) > due);
      if (!window)
        return finish(
          "unknown",
          "schedule-outside-horizon",
          "Nächster erlaubter Wechsel liegt außerhalb des Prüfzeitraums."
        );
      due = time(window.start);
      result.expectedAt = iso(due);
    }
  }
  if (due === null)
    return finish("unknown", "telemetry-missing", result.reason);
  const attempts = [...(row.attempts || []), ...(state.retainedAttempts || [])]
    .filter(
      (a, index, all) =>
        all.findIndex((b) => b.attemptId === a.attemptId) === index
    )
    .sort((a, b) => (time(b.startedAt) || 0) - (time(a.startedAt) || 0));
  // Retain bounded evidence across the API's five-day log retention and monitor restarts.
  state.retainedAttempts = attempts.slice(0, 20);
  const matching = attempts.filter(
    (a) =>
      a.paperId === row.slideshowId &&
      a.trigger === "cronjob-slideshow" &&
      row.sourceIds.includes(a.sourcePaperId) &&
      time(a.startedAt) !== null &&
      time(a.finishedAt) !== null &&
      time(a.startedAt) >= due - preparationAheadMs &&
      time(a.startedAt) <= now &&
      time(a.finishedAt) <= now
  );
  const accepted = matching.find(
    (a) =>
      a.status === "uploaded" ||
      (a.status === "skipped" && a.identical === true)
  );
  const overdue = now > due + graceMs;
  if (!accepted) {
    const latest = matching[0];
    result.preparation =
      latest?.status === "failed" || latest?.status === "partial"
        ? "failed"
        : "pending";
    if (overdue)
      return finish(
        "failed",
        result.preparation === "failed"
          ? "upload-failed"
          : "preparation-overdue",
        result.preparation === "failed"
          ? "Der fällige Bildwechsel ist beim Upload fehlgeschlagen."
          : "Für den fälligen Bildwechsel fehlt eine erfolgreiche Vorbereitung."
      );
    if (
      nextSync === null ||
      time(telemetry.fileVersion) === null ||
      time(telemetry.lastReachableAt) === null ||
      typeof telemetry.pictureSynced !== "boolean"
    )
      return finish("unknown", "telemetry-missing", result.reason);
    return finish(
      state.lastSuccessfulCycleAt ? "passed" : "watching",
      "awaiting-cycle",
      state.lastSuccessfulCycleAt
        ? "Letzter Wechsel bestätigt; nächster Wechsel noch nicht fällig."
        : "Beobachtung gestartet; der erste Bildwechsel ist noch nicht bestätigt."
    );
  }
  result.preparation = accepted.identical ? "unchanged" : "uploaded";
  result.sourcePaperId = accepted.sourcePaperId;
  result.lastUploadAt = accepted.finishedAt;
  result.attemptId = accepted.attemptId;
  // A retry of the same due time is not a second slide. Compare only distinct confirmed cycles.
  if (
    row.sourceIds.length > 1 &&
    state.lastSuccessfulCycleAt &&
    state.lastSourceId === accepted.sourcePaperId &&
    state.lastAttemptId !== accepted.attemptId &&
    time(accepted.startedAt) > time(state.lastSuccessfulCycleAt)
  ) {
    return finish(
      "failed",
      "source-not-advancing",
      "Mehrere bestätigte Wechsel verwenden dasselbe Quellbild trotz mehrerer Bilder."
    );
  }
  const version = time(telemetry.fileVersion);
  const reachable = time(telemetry.lastReachableAt);
  const latestWrite = attempts.find(
    (a) =>
      a.status === "uploaded" ||
      a.status === "partial" ||
      a.status === "started"
  );
  const versionMatches =
    version !== null &&
    version >= Math.floor(time(accepted.startedAt) / 1000) * 1000 &&
    version <= time(accepted.finishedAt) + 1000;
  const superseded =
    latestWrite && time(latestWrite.startedAt) > time(accepted.startedAt);
  const retrieved =
    telemetry.pictureSynced === true &&
    reachable !== null &&
    reachable <= now + MINUTE &&
    version !== null &&
    reachable >= version &&
    !superseded &&
    (accepted.identical ? reachable >= due : versionMatches);
  result.retrieval = retrieved
    ? accepted.identical
      ? "unchanged-reported"
      : "reported-synced"
    : "unconfirmed";
  if (!retrieved) {
    if (overdue)
      return finish(
        "failed",
        "retrieval-overdue",
        "Bild vorbereitet, aber kein passender Geräteabruf nachgewiesen."
      );
    return finish(
      "watching",
      "awaiting-retrieval",
      "Bild vorbereitet; Geräteabruf noch nicht bestätigt."
    );
  }
  if (now < due)
    return finish(
      "watching",
      "awaiting-due-time",
      "Bild bereits synchronisiert; geplanter Wechsel steht noch aus."
    );
  if (nextSync === null)
    return finish(
      "unknown",
      "telemetry-missing",
      "Bildabruf gemeldet, aber der nächste Abruftermin fehlt."
    );
  if (nextSync <= due)
    return finish(
      overdue ? "failed" : "watching",
      "device-schedule-stale",
      "Der Rahmen meldet noch keinen neuen Abruftermin."
    );
  state.lastSuccessfulCycleAt = iso(now);
  state.lastSourceId = accepted.sourcePaperId;
  state.lastAttemptId = accepted.attemptId;
  result.lastSuccessfulCycleAt = iso(now);
  due = nextSync;
  return finish(
    "passed",
    "cycle-confirmed",
    "Bild vorbereitet und passender Geräteabruf gemeldet. Displaydarstellung nicht geprüft."
  );
}

export function evaluateScan(
  rows,
  previous = {},
  now = Date.now(),
  options = {}
) {
  const devices = {};
  const results = rows.map((row) => {
    const evaluated = evaluateDevice(row, previous[row.deviceId], now, options);
    devices[row.deviceId] = evaluated.state;
    return evaluated.result;
  });
  const counts = {
    total: rows.length,
    passed: 0,
    failed: 0,
    unknown: 0,
    watching: 0,
  };
  for (const result of results) counts[result.status]++;
  const status = counts.failed
    ? "failed"
    : !counts.total || counts.unknown
    ? "unknown"
    : counts.watching
    ? "watching"
    : "passed";
  return {
    devices,
    summary: {
      schemaVersion: 1,
      checkedAt: iso(now),
      status,
      counts,
      results,
      reason: counts.total
        ? `${counts.passed} bestätigt, ${counts.failed} fehlerhaft, ${counts.unknown} unbekannt, ${counts.watching} in Beobachtung.`
        : "Keine zugewiesenen Diashows gefunden; keine Funktionsbestätigung.",
      displayVerification: "not-available",
    },
  };
}
