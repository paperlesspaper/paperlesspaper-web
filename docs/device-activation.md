# Device activation and ownership transfer

The Paperlesspaper API overrides the shared library's registration handlers for
`epd*` devices. The existing authentication, organization authorization and request
validation middleware remain in place; other device families use the original
handlers. No change or publication of `@internetderdinge/api` is required.

## API behavior

- `GET /devices/registration-status/:deviceId?organization=...` inspects the global
  local assignment and IoT state. It returns `available: true` and a `mode` of
  `activation`, `takeover`, or `already_registered`. It never resets a device.
- `POST /devices/registerdevice/:deviceId` with `enable: true` starts activation.
  Ordinary claiming never resets a device, including an active orphan without
  local assignment. Missing records and inactive/timeout statuses are not proof
  of ownership and do not authorize removing an existing assignment. A fresh
  key for the target organization completes registration directly, including
  after a failed local save, without restarting activation. A stale assignment
  is replaced only after that confirmation, preserving its owner's papers.
- Polling uses the same authorized organization and `enable: false`. IoT
  `success` without a nonempty key is returned as `timeout`, not completion.
- `registrationCompleted: true` and `createdDevice` are returned only after IoT
  confirms the target organization with a key and the local assignment is saved.
  The key stays on the server and is not persisted or included in responses.
- Ownership transfer uses sequential writes and works with standalone MongoDB.
  The old device document is deleted and a fresh assignment is inserted with a new
  `_id`. Old settings, patient, paper and billing fields are not transferred.
  Papers remain with their original owner. Before inserting a new assignment,
  the serial-keyed `ePaperDeviceImages/<serial>.png` comparison image is deleted
  from S3, allowing the next image to upload even if it matches the old owner's
  image. Paper originals and previews are preserved. A failed cache deletion
  stops completion and is retried on the next poll. Repeated completion for the
  same owner preserves their current data and image cache. Concurrent completion
  by the same verified owner recovers unique-index conflicts by returning the
  saved assignment. A conflicting assignment for another owner is not accepted.
  The assignment is read before requesting proof and checked again before
  cleanup. Replacement of that assignment while IoT/cache operations are pending
  fails with 409; deletion also checks the exact old ID and organization.
- If IoT succeeds but MongoDB fails, polling retries completion with fresh IoT
  proof. Partial writes are accepted: old paper links may already be detached,
  and the old device may be removed before insertion fails. No database rollback
  or transaction is used. Polling does not reset IoT. Choosing Start again with
  fresh target-organization proof also finishes storage without resetting IoT.
- User-visible upload logs are restricted to the authorized database device ID;
  serial-only logs and logs from an earlier ownership assignment are excluded.

## WLAN and the UI

For registration, the user can connect BLE, select WLAN and enter the password
before the five-minute activation window starts. Immediately before writing
either credential, the UI awaits activation `pending`. After the write it polls
every four seconds without starting another activation. Existing WLAN uses the
button confirmation path. The Wi-Fi introduction offers this path explicitly
for manually entered device IDs as well as QR codes with a connected status.
Selecting it starts the same server-verified activation; it neither opens BLE
nor writes credentials, and never treats the user's selection as ownership
proof. The ordinary Wi-Fi change dialog does not offer this registration action.
Cancellation invalidates outstanding responses and
clears polling timers and aborts in-flight activation requests. The UI rejects
unverified legacy `success` responses and unsupported states.

Activation requests have a 20-second client deadline. An independent five-minute
deadline also bounds a stalled poll or deferred WLAN step. A local expiry is
reported as an unconfirmed connection outcome, not a confirmed IoT timeout.
Preflight status reads retry temporary network / HTTP 502, 503, 504 errors at
most twice; HTML gateway responses are included. A lost start acknowledgement
is recovered with a status poll (`enable:false`), never by automatically replaying
the start. Permanent errors such as 403 stop polling immediately.
The normal error screen uses actionable EN/DE/NL messages; technical details
remain available separately.

The visible initial countdown is 60 seconds, followed by “This is taking a
little longer...”. The actual activation window remains five minutes.
IoT-client exceptions are normalized to HTTP 502 at the registration boundary:
the shared client's generic 404 must not imply an unknown device or prevent
safe status-read retries. Target-organization membership and role failures
still return 403 before the IoT call.

Temporary compatibility (2026-09-22): the deployed IoT status-only endpoint can
omit `activation_status` for a frame whose database record has no activation
state. The API maps only the observed successful e-paper response (matching
organization, exact status-only message, absent status and key) to `unclaimed`.
This allows preflight and an explicit activation start; it is never ownership
proof and does not change assignments, papers or images. Start acknowledgements
and all other malformed/error responses remain subject to the existing checks.
Remove this fallback once IoT reliably returns its documented `unclaimed` state
for these devices. No mobile app or firmware update is needed for this workaround;
the Paperlesspaper API must be deployed.

Failed BLE reconnection and Wi-Fi-list reads transition to the retry screen.
A failed reconnect cancels its session so late reads cannot hide that error.
These paths have simulated native-platform regression coverage; real iOS and
Android permission/connection tests are still required.

The ordinary **Connect new Wifi** dialog has no activation callback: it writes
credentials without sending an activation or reset request or altering local
assignments. Preserving IoT images/activation during this normal WLAN change is
also required of firmware/IoT. Daniel's supplied API documentation says `act: 0`
deletes images; the documented BLE interface has no separate non-destructive
WLAN-change command. This branch cannot change that server/firmware behavior.
Verify that IoT distinguishes normal WLAN changes from ownership transfers
before releasing this behavior end to end.

The acknowledged possibility of a normal button press confirming an unwanted
claim remains an IoT/firmware limitation. Competing claims by multiple new
organizations have regression coverage for delayed proof/cache responses and
unique-index conflicts. End-to-end serialization of the IoT proof and local
assignment would still require a claim generation or equivalent upstream protocol.

## Verification

No physical device, production API or production database is used by these tests.

```sh
node_modules/.bin/vitest run --config packages/paperlesspaper-web/vitest.config.ts tests/unit/useDeviceActivation.test.tsx tests/unit/bluetoothActivationOrder.test.tsx
REGISTRATION_TEST_MONGODB_URL='mongodb://127.0.0.1:27184/paperless-registration-test-local' node_modules/.bin/vitest run packages/paperlesspaper-api/tests/integration/deviceRegistration.persistence.test.ts
```

The MongoDB suite requires a disposable database whose name begins with
`paperless-registration-test-`; a standalone MongoDB is sufficient. It tests
partial failures and retry, idempotent completion, key gating, orphan repair,
cache invalidation and preservation of papers. S3 and IoT are mocked.

The review's log-isolation and hanging-poll regressions were fixed on September
21, 2026. See `output/onboarding-activation-2026-09-21.md` for tests, the read-only
test-frame inspection, and remaining hardware / upstream validation.

Deploy the API before the updated UI: the new UI deliberately requires
`registrationCompleted` for e-paper registration success.
