# Slideshow preparation and early device contacts

Only `slides` use the interval-based preparation policy:

| Configured interval                            | Preparation lead |
| ---------------------------------------------- | ---------------- |
| Up to and including 2 hours                    | 5 minutes        |
| More than 2 hours, up to and including 8 hours | 10 minutes       |
| More than 8 hours, below 24 hours              | 15 minutes       |
| 24 hours or more                               | 25 minutes       |

Missing/invalid intervals use five minutes. Playlists and dynamic integrations
retain their five-minute window. This changes server preparation, not the
sleep timer. A manual device refresh can retrieve an already-prepared next slide.
The worker's four-minute cadence and rendering time consume part of the lead.

## Outstanding cycle

On the first successful status observation, the cronjob records the expected
cycle in `meta.paperCronjobSync`, even outside the preparation window. Its state
is `pending`, `processing`, or `completed`. A later device prediction cannot
replace a pending or processing cycle with a later deadline. An earlier
prediction brings a pending cycle forward. Failed uploads return to pending;
the next run retries that cycle. If an early contact already advanced the
prediction, the catch-up image covers that next contact (`coveredThrough`).
It must not be overwritten by another slide before that contact. Once the
prediction advances beyond it, a new cycle can be tracked, without replaying
an accumulated backlog of missed slides.

The configuration fingerprint covers the organization, physical device name,
selected slideshow, sources/order, interval and update schedule. Changing configuration replaces a pending cycle;
an active upload keeps its lease until completion or the existing 15-minute
stale timeout. MongoDB compare-and-set updates prevent stale scans from
replacing another worker's state. Individual lease IDs fence completion and
release writes after takeover. The in-memory device retains the state because
upload helpers may save that document. The already-persisted local lease is
not marked dirty, and the frame-pending helper saves only its own metadata
path, preserving concurrent settings/lease updates. Settings are also compared
atomically when creating and claiming a cycle, so a stale scan cannot start an
upload after an interval or schedule change.

Existing completed/processing claims without a fingerprint are honored for the
same slideshow. No migration is required. Dry runs never persist state or upload.

This cannot reconstruct deadlines lost before the first observation. Preparing
after an early contact cannot wake an already sleeping frame: the image becomes
available at its next contact. A process crash after a successful external upload
but before persisting completion still has the existing retry ambiguity; this is
not an exactly-once delivery guarantee.

## Monitor and rollout

The API snapshot publishes `preparationAheadSeconds` using the same policy as
the cronjob. The monitor uses it only to correlate preparation attempts with a
cycle. Retrieval checks and the late grace period are unchanged. Old API
snapshots fall back to five minutes. Deploy the updated monitor before the API,
otherwise early uploads may temporarily appear as missing preparation.

After deployment, inspect several real cycles, including 8-hour and 24-hour
frames. Verify one preparation per expected cycle, retries after renderer errors,
and separate upload success from reported device retrieval. No firmware update
or changes to user-selected intervals are needed.

## Retest limits and user-visible effects

The 2026-11-01 local retest reproduced and fixed four additional cases: unseen
catch-up slides being overwritten, an earlier prediction being ignored, a
settings change racing status retrieval, and stale whole-meta saves restoring
an old lease/settings. Regression coverage includes real MongoDB persistence
and the actual frame-pending helper's Mongoose change tracking.

A timing simulation of 1,987 recorded contact intervals is a sensitivity study,
not an observed Production success rate. At a four-minute cadence with a fixed
60-second processing duration and no extra status-message offset, all 827 sampled
cycles above two hours fit the expanded windows for every tested cadence phase.
Adding status delay or longer processing can still miss individual contacts;
short intervals keep their existing five-minute window. The persistent catch-up
protects the next available image, but cannot wake a sleeping frame.

Slideshows can include dynamic sources as well as photos. A calendar/weather
slide may therefore contain data rendered up to 25 minutes earlier. Standalone
dynamic integrations and playlists still use five minutes. Manual refresh can
show the next prepared slide early. The change adds one pending-state database
write per newly observed slideshow cycle, not an unbounded history or extra
normal-cycle rendering. API and monitor updates do not change Wi-Fi, sleep
intervals, device firmware, or reset devices.

An upload already in flight cannot be atomically canceled together with a user
settings change or lease expiry; remote upload and database completion are not
a single transaction. Test in Development and observe real device retrieval
before declaring the production issue fully resolved.


## Security retest: frame and organization binding

The preparation lead does not choose the destination: uploads use the target
Device's physical `deviceId`, never a source image's original device. Concurrent
uploads retain their own buffers, signed URLs, device cache keys and worker leases.
The 2026-11-01 security retest added explicit negative and positive coverage for
these bindings; it did not inspect or modify Production devices.

A reproduced pre-existing side effect was removed: slideshow rotation used the
general `updateById` helper, which also synchronizes device selection. Advancing a
shared slideshow on frame B could reactivate it on its original frame A. Rotation
now writes only progress fields with an atomic organization/kind/selection/order
filter. It never invokes device activation, never writes a stale whole-meta
snapshot, and refuses to save progress if ownership or selection has changed.
Retry progress uses the same filter. Real MongoDB tests verify that unrelated
user settings survive and concurrent ownership/selection changes reject the write.

The cronjob also revalidates the database device ID, physical device name,
organization, selected slideshow, settings and exact processing lease around
rendering/upload stages. Both the parent slideshow and refetched source must
still belong to the target organization. A revoked target stops the entire job,
not just the current candidate. Completion/release are ownership and lease fenced.
Device organization and physical name are immutable in ordinary model updates;
the takeover regression tests delete the old registration and create a new one,
as registration does. Separate raw MongoDB tests cover privileged bypass changes.

IoT activation precedes local registration completion. Therefore the guard also
checks the IoT service's `organizationName` at candidate selection, immediately
before the image PUT, and after PUT before writing the device-specific cache.
Intermediate guards only recheck local data. Local assignment is checked after
the remote lookup returns, so a transfer during that lookup is rejected too.
Missing/unavailable ownership proof cancels the upload and leaves it retryable;
this deliberately trades availability for isolation. A normal successful upload
adds three remote ownership lookups plus bounded database checks. Failed source
fallbacks can add selection lookups, up to the existing three-candidate limit.
No Production latency/load benchmark was performed; these calls consume some
preparation time and must be observed on rollout.

These are application-level checks, not an atomic ownership transaction with the
IoT service or object storage. A transfer after the last check, especially during
an already-started PUT, can still race delivery. The post-PUT guard blocks an old
worker from restoring the device cache when it detects that transfer, but cannot
retract the in-flight payload. Stronger guarantees require an ownership generation
or equivalent fencing enforced by the IoT upload/final activation service and
revocation on takeover. This is not implemented here. The timing change did not
introduce this distributed-system limitation, but wider preparation windows make
careful handling of concurrent changes particularly relevant. No actual Production
cross-organization delivery was established by this local review.


Upload guards run at candidate selection and at write boundaries. The uploader
checks before paper-image writes, signed-upload URL creation, device PUT and the
device cache write. Snapshot and frame-pending helpers check internally, after
their status lookup, only when they will write. Snapshot guard failures propagate;
optional snapshot I/O failures remain non-fatal. Duplicate checks at renderer and
uploader entry have been removed. Progress persistence retains its target check
and atomic database filter. The three remote ownership checks are unchanged.
