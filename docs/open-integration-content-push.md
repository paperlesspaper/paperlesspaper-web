# Paper-scoped content push for Open Integrations

The host provides a generic content inbox for a saved `kind: plugin` paper.
All Telegram-specific logic lives in the separate `paperlesspaper-telegram`
repository. The same host protocol can be used by other integrations.

## Manifest and settings

```json
{
  "settingsPage": "./settings.html",
  "renderPage": "./render.html",
  "requiredPermissions": ["paper:content:write", "paper:delivery:read"],
  "capabilities": {
    "contentPush": { "callbackPath": "/api/paper-status" }
  }
}
```

The manifest, settings page, renderer, and callback must share an HTTPS origin.
The saved effective settings/render URLs are included in the connection identity.
Changing that identity requires reconnecting. The callback URL comes from the saved
manifest; an unauthenticated client cannot override it during grant exchange.

After receiving the existing `INIT` payload with `paper.id`, a settings iframe sends:

```json
{"source":"paperlesspaper-plugin","type":"REQUEST_CONNECTION","payload":{"requestId":"unique-browser-request"}}
```

The host checks both `event.source` and `event.origin`. It creates a one-time grant
with the current user's authentication and replies only to that iframe:

```json
{"source":"paperlesspaper-app","type":"CONNECTION_GRANT","payload":{"requestId":"unique-browser-request","grant":"opaque-five-minute-code"}}
```

Invalid, opaque, credential-bearing, and mismatched settings origins are refused.
Settings pages must use HTTPS; HTTP is allowed only on loopback for local development.
Initialization and redirect tokens never use a wildcard `postMessage` target.
Restricted (`onlyself`) organization members cannot obtain or use push
connections. Membership and role are checked again on each connection use and
before queued uploads/callbacks, so a role downgrade also removes existing access.

Errors use the same message with `payload.error`. A paper must be saved first.
The integration forwards the grant to **its own backend**. That backend exchanges
it with the operator-configured host API. An ID in an iframe is not authorization.
Permanent tokens never pass through the iframe or become plugin settings.

## Endpoints

All paths below are relative to `/v1/integration-papers`.

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `POST /papers/:paperId/grants` | User login + organization membership | Body `{configUrl, settingsPage}` must match the saved integration. Returns `{grant}`. |
| `POST /exchange` | Single-use grant | Body `{grant}`. Returns `{connectionId, paperId, name, token, callbackToken}` to the integration backend. |
| `GET /papers/:paperId/content` | User login + organization membership | Private app preview response `{content, configUrl, renderUrl}`, bound to its authorized renderer. |
| `DELETE /papers/:paperId/connection` | User login | Revokes only this user's paper connection and pending grants; usable even with a broken manifest. |
| `POST /connections/:connectionId/content` | Paper connection bearer token | Accept content durably. |
| `GET /connections/:connectionId/status` | Paper connection bearer token | Latest request for this connection, with individual frame states. |
| `DELETE /connections/:connectionId` | Paper connection bearer token | Revoke this connection. |

Content body:

```json
{"messageId":"provider-stable-id","text":"Hello","imageBase64":"optional-base64-file"}
```

Text/captions have a 1,000-character limit; source images accept JPEG/PNG/WebP up to
20 MB and 40 MP. Images are normalized, stripped of input metadata and stored in
private S3. The endpoint returns `202` with `{requestId,paperId,messageId,state}`
after durable acceptance. This is not proof of display. The same message ID and
content returns the same request; a different payload under that ID returns `409`.
IDs are scoped to the connection and its current generation. Receiving records
recover on provider retry.

An active connection's credentials are reused on subsequent grant exchanges.
Revocation followed by reconnection, or a change of provider or organization,
rotates both secrets and an internal connection generation. Queued requests,
callbacks and status queries are bound to that generation and source; reconnecting
cannot revive old work or forward historical status to the new provider.
Authentication looks up
the token hash; the recoverable token and callback token are excluded from default
model selection and stored only in the protected backend database. Restrict DB and
backup access. Permissions and configuration identity are rechecked on incoming
requests, background processing, and callback dispatch.

## Processing and rendering

A globally serialized content-processing sweep runs every 30 seconds. It selects
the earliest next-check time first, so older active papers cannot continually
displace new ones. Callbacks have a separate serialized BullMQ queue, so a slow
callback does not hold up image processing. Both queues use MongoDB as the durable
source of pending work, so accepting content does not depend on an immediate Redis
job enqueue. The API rejects new grants/content when BullMQ is disabled.
Integration worker startup is independent of the existing host cronjobs and health
initialization. A failed or stalled integration startup is logged separately.

The latest accepted source belongs to one paper. Each currently assigned e-paper
frame receives an independent delivery record. A paper with no frames can still
receive content. The sweep watches for assigned frames for 48 hours; later ordinary
scheduled rendering can still use the persisted content, but that old request no
longer starts new delivery receipts. Selecting a different paper never gets
reversed by this worker.

The existing render payload gains `integrationContent: {revision,text,imageUrl?,
receivedAt}`. The normal renderer performs layout; the host dithers/uploads the
result. App previews use the authenticated content endpoint and refuse to forward
stored content to an unsaved different renderer. Errors preserve the previous
frame image. A failed message remains the current source until a new message is
submitted; shorten invalid text or resend a supported image.

The preview also checks the actual iframe URL and the response's `configUrl` and
`renderUrl`, preventing cached content from a previous provider from reaching the
new renderer. Messages target the configured origin, never `*`. Integrations that
redirect their renderer to another origin must instead configure its direct URL.

The latest source wins. Same-millisecond accepts use request ID as a deterministic
tie-breaker. Retrying an older request cannot replace a newer current source. This
is a latest-content feed, not a playlist. Frames on the same paper share content.

## Status callbacks

The generic outbox sends JSON to the registered callback with:

```http
Authorization: Bearer <callbackToken>
Content-Type: application/json
```

```json
{
  "eventId":"stable-event-id",
  "connectionId":"connection-id",
  "paperId":"paper-id",
  "requestId":"host-request-id",
  "messageId":"provider-stable-id",
  "state":"synced",
  "deviceId":"frame-id",
  "frameName":"Kitchen",
  "occurredAt":"2026-09-20T10:00:00.000Z"
}
```

`available` and paper-level `superseded`/`unconfirmed` omit frame fields. Frame
states are `prepared`, `synced`, `superseded`, `inactive`, `failed`, `unconfirmed`.
Receivers must validate the token/connection/paper, persist the event before
responding with 2xx, deduplicate `eventId`, and tolerate out-of-order events.
No HMAC signing is required by this protocol.

The sender validates URLs, resolves DNS on every attempt, rejects private/reserved
addresses, pins the validated address for the TCP/TLS connection, and never follows
redirects. Only HTTPS port 443 is accepted in production. A development-only
`INTEGRATION_ALLOW_LOCALHOST=true` enables explicit loopback endpoints for tests.
Failed callbacks use exponential backoff up to one hour between attempts. Events
expire after seven days; failed events do not block later callbacks.

`prepared` means rendering/upload succeeded. `synced` requires `pictureSynced`, a
file version newer than the pre-upload version, a matching upload window, fresh
reachability and the latest successful upload log's `integrationRevision`. This is
device-reported synchronization, not optical display verification. Missing or
stale evidence never produces success. Unconfirmed deliveries time out after 48
hours. No API request wakes an offline or sleeping frame.

A crash between an external side effect and its state write can repeat an upload
or callback. Exactly-once delivery is not claimed. Terminal delivery states recreate
missing outbox events after a crash. A revoked or unauthorized connection stops work
and callbacks.
Transient database failures during authorization are retried; only explicit
access/configuration denials or a mismatched connection generation cancel work.
Operations already sent to an external service cannot be recalled by revocation.

## Operations and migration

The host reuses MongoDB, BullMQ/Redis, S3 and device API settings. No Telegram bot
secrets or Telegram URL allowlist are required. The host web app and API must be
deployed together with an integration supporting this protocol.
Connections created before generation binding must be reconnected once. Pending
legacy requests and callbacks without a generation are rejected rather than
attributed to the new connection. No database backfill grants old work new access.

Request and delivery records expire after 30 days; callback events after seven
days. Current paper content and connection records remain persisted. Add an S3
cleanup policy for superseded `integration-push/` objects which preserves objects
referenced by current content. Payloads and secrets must not be added to request
logs.
