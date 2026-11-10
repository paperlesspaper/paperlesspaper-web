# Organization image storage

Each organization has **500 MB = 500,000,000 bytes**. This is a storage quota,
not an image-count, slideshow-size or per-request limit. Existing image formats,
compression and variants remain unchanged.

## Accounting

The account includes current S3 objects for all paper images (device PNG, original
JPEG and PNG, thumbnail, editable JSON), integration-push images, legacy direct
device uploads, current-frame snapshots and device comparison images. MongoDB
documents, device logs and S3 non-current object versions are not included.

On first use, paginated S3 listings initialize the organization from its existing
papers and devices. No existing images are deleted. Legacy organizations above
the limit can delete images and replace them with images of equal or smaller
total size. New growth is rejected with HTTP 413 and a translated message in the
web client. Slideshow references do not themselves consume quota; their stored
rendered previews do.

`GET /papers/storage-usage?organization=ID` requires authentication and membership
of that organization and returns `usedBytes`, `limitBytes`, and `remainingBytes`.
The library and multi-upload editor show usage. Multi-upload stops on a quota
error and retains pending images for retry, including the already-created paper ID.

All image writers use the same MongoDB-backed organization mutex, across replicas
and background workers. Replacement batches check the net byte delta and write
shrinking variants before growing variants. Every write reserves its high-water
size before S3 I/O, then commits the actual known size on success. This also
retains editable JSON when a subsequent render does not replace it. S3 copies
measure their source while holding the same lock. Cross-organization paper moves
are rejected; create a paper in the destination organization instead.

Deleting a paper deletes all its image variants and integration-push images before
removing the paper document. Failed deletion does not remove the document or free
unconfirmed capacity. Device snapshots remain independently accounted until
replaced or reset. A device ownership reset releases its comparison-image usage.

## Deployment and recovery

Deploy the API before the web client. **Stop/drain old API replicas and workers
before enabling new writers**: old code does not participate in quota accounting.
The S3 identity needs ListBucket, HeadObject (GetObject), PutObject and DeleteObject
access to the existing image prefixes. MongoDB creates `storageaccounts` and
`storageobjects`; the built-in `_id` indexes enforce uniqueness.

Initialization is lazy; to prepopulate a large organization's usage, use the
offline reconciliation command below before restarting writers. Images whose
paper/device was deleted before this feature cannot be attributed from the
remaining database alone. Review a separate bucket inventory for those orphaned
objects; this feature does not automatically delete historical orphans. If S3
versioning is enabled, configure an appropriate non-current-version lifecycle
separately: overwrites/deletes alone do not reclaim those versions' billed bytes.

An uncertain S3 write/delete, a bookkeeping failure after reserving, or a process
crash deliberately leaves the organization locked and its reservation charged.
Subsequent mutations return HTTP 409 after at most 15 seconds. Locks do not expire
automatically: a delayed S3 request must not be able to complete after another
writer has reused its space. Monitor `storageaccounts.lockedAt` for locks older
than normal storage operations and investigate the associated API error logs.

To recover or reconcile manually changed storage:

1. Stop **all** API instances, workers and any external writers to these keys;
   let in-flight S3 operations finish. Do not clear a live lock.
2. With the normal API MongoDB/S3 environment, run from the API package:

   ```sh
   npm run storage:reconcile -- ORGANIZATION_ID --writers-stopped
   ```

3. The command inventories current owned prefixes, HEADs all known keys (including
   reserved and deleted ones), recalculates usage and releases the lock only after
   successful reconciliation. It does not delete images. Restart writers.

The persistence tests use real MongoDB and simulated S3 sizes, never production
credentials or storage:

```sh
STORAGE_TEST_MONGODB_URL=mongodb://127.0.0.1:27017/paperless-storage-test-local \
  npx vitest run tests/integration/storage.persistence.test.ts
```
