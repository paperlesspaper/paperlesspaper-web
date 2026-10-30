# paperlesspaper-slideshows

Independent, read-only fleet monitor for assigned `kind: slides` papers. Does not
advance slides, render/upload images, reset devices, change settings or create
support tickets. Playlists and other integrations are not part of this monitor.

## Components

- API: `GET /v1/monitor/slideshows?after=<ObjectId>` returns 20 assigned frames per
  page, available source IDs, a configuration fingerprint, the sync claim,
  normalized IoT status and the last 20 upload attempts. Every page must succeed.
  The dedicated bearer secret `SLIDESHOW_MONITOR_TOKEN` (at least 32 characters)
  grants access only to this read-only endpoint. It is not an account/admin token.
  No raw IoT responses, image URLs, customer names or upstream errors are exposed.
- This service evaluates the fleet independently of BullMQ, persists pinned
  deadlines and publishes runs to the existing Admin Live Monitor ingestion API.
- The Admin shows per-frame results and marks a stale latest run explicitly.
  Production and development are separate overview cards.

## Evidence and states

`passed` means the last observed due cycle has a successful `cronjob-slideshow`
attempt and the reported current file version fits its upload time range, with
`pictureSynced` and a sufficiently recent device contact. This is a reported
retrieval, **not optical proof or a firmware display-refresh acknowledgement**.
The upstream status has no attempt ID/hash, so this temporal correlation is the
strongest available evidence; it must not be labelled an exact image-hash proof.

`watching` means an initial cycle or retrieval is still pending. `unknown` means
telemetry, a usable schedule or inventory is absent. `failed` identifies missed
preparation/retrieval, stuck claims (15 minutes), invalid sources or repeated
source selection. `error` means the complete scan failed; a partial inventory
is never evaluated as a healthy fleet. An empty inventory is unknown.

The default grace period is five minutes after the device's expected sync.
Deadlines remain pinned even if telemetry moves its next sync forward. They
advance only after a confirmed cycle or a changed configuration. Allowed update
windows defer expected work; no upcoming window within seven days is explicitly
unknown. A one-image slideshow and intentional identical-image skips are allowed.
`partial` uploads and arbitrary skips never count as success.

This catches new incidents while running. It is not a complete historical audit:
the API retains upload logs for five days, returns 20 attempts per frame, and
device telemetry reports the current image only. Multiple transitions between
checks cannot all be individually proven. Persisted recent evidence survives
restarts; changes of slideshow/sources/interval/schedule reset the baseline.

## Verification

```sh
node --test packages/slideshow-monitor/test/*.test.mjs
# Read-only check: does not save state, publish reports or notify anybody.
node packages/slideshow-monitor/src/index.mjs check
# One persistent check, publishing its report:
node packages/slideshow-monitor/src/index.mjs check --publish
```

The environment must be supplied by the shell/container; files are not loaded
automatically. `ALLOW_HTTP_LOCAL=true` is for local test fixtures only. Requests
have deadlines, reject redirects and do not print credentials or error bodies.

## Deployment

1. Release the snapshot endpoint on the intended API and set a new dedicated
   `SLIDESHOW_MONITOR_TOKEN`. Do not deploy unrelated PR changes just for this.
2. Release the Admin view/API extensions in `internetderdinge-admin`. Reuse its
   existing `LIVE_MONITOR_INGEST_TOKEN` as the service's `ADMIN_MONITOR_INGEST_TOKEN`.
3. Configure the values from `.env.example`. Never reuse a production state volume
   or token for development. Confirm the snapshot and ingestion URLs explicitly.
4. Build from the monorepo root with
   `docker build -f packages/slideshow-monitor/Dockerfile .`, or deploy the Compose
   file with the repository root build context. No public port is needed.
5. Run exactly **one replica per environment** with a persistent `/data` volume
   owned by UID 1000. The Compose hostname is stable for crash lock recovery.
   Do not mount the volume concurrently into a different host/container. If
   changing the hostname, stop the old instance before removing its `.lock` folder.
6. Confirm a fresh run in Admin, successful pagination and the intended inventory
   size. Initially expect `watching` until due cycles have actually been observed.

Stopping the service does not change any devices. Keep `/data` for restart.
Restoring the prior API release only makes the monitor report scan errors.

## Alerts and monitoring the monitor

Without `ALERT_WEBHOOK_URL`, results appear only in Admin. A configured HTTPS JSON
receiver gets a `failure` event after two consecutive problematic scans, changes
of affected devices/reasons, and reminders every six hours. It gets `recovery`
only when the entire monitored fleet is confirmed again (not on unknown/pending
data). No emails are sent unless the chosen receiver sends them. Events contain
an `eventId` for receiver-side deduplication; a network failure can cause a retry.
No automatic customer messages or issue creation occur.

Configure `MONITOR_HEARTBEAT_URL` with an independently hosted dead-man switch to
detect a stopped host/service or broken report publication. It is pinged only
after publishing and persisting a complete run result (which may itself report
a fleet fault). Docker health reports scanner/report-delivery liveness, not the
health of every frame. Admin's stale indicator alone cannot send an outage alert.

The fleet inventory is regenerated each scan; removed assignments disappear from
active state. Runs live in the existing Admin history. Configure a separate,
reviewed retention policy for that history; this monitor does not delete reports.
