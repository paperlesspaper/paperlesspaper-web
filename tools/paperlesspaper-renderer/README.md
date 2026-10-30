# Isolated paperlesspaper renderer

Chromium, per-render filtering proxies, readiness checks and the public asset cache run in this container. The API keeps dithering, stored-image reuse, database access and uploads. The render result includes the original PNG bytes, dimensions, diagnostics and `epdoptimize` metadata.

The service listens only on `/run/paperlesspaper-renderer/renderer.sock` (0600, UID 1000). Prefer mounting the named volume in the API **read-only**, at the same path, and set `RENDER_SERVICE_SOCKET=/run/paperlesspaper-renderer/renderer.sock`. Unix sockets can be connected to through a read-only mount. No TCP port, shared database network, API key or other persistent credential is needed. Both containers must run on the same Docker host as UID 1000. The Docker volume stores only the socket, not images or job payloads. Do not mount it in unrelated services.

Production API containers refuse browser rendering if the socket is missing; a broken renderer never causes a local Chromium fallback. Local development and tests without `NODE_ENV=production` can still use a locally installed browser via `CHROME_BIN`. Browser rendering errors retain the existing device image through the existing API error path. Two concurrent jobs are supported. The API drains bursts through two slots, with at most 300 waiting requests, 32 MiB of queued payloads and a four-minute queue wait. Expired requests are removed before execution. The renderer itself still rejects excess requests with 503; the API retries only explicit busy responses (no work started), within the 65-second transport budget, to tolerate overlapping API replicas during deployment. Other failures are not retried by the transport. Requests are limited to 16 MiB, responses to 24 MiB, and jobs to 60 seconds. A client disconnect/deadline closes that job's browser context and proxy. Normal per-job data, including any content a plugin needs, is still transmitted; do not put unrelated service credentials in a render payload.

## Development rollout (single Dokploy host)

1. Pause automatic API deployment during the coordinated rollout. Keep its current image until the renderer passes health and render checks.
2. Create a **Docker Compose** service in paperlesspaper/development from the same Git revision as the API. Compose path: `tools/paperlesspaper-renderer/compose.development.yml`. Use Compose, not a Swarm stack: build and per-container restrictions are required. No domain or port mapping.
3. The supplied configuration explicitly runs Chromium with `--no-sandbox` (`RENDERER_DISABLE_CHROMIUM_SANDBOX=true`). The dedicated container is the isolation boundary: UID 1000, **all Linux capabilities dropped**, `no-new-privileges`, Docker's default seccomp/AppArmor policies, a read-only root, bounded tmpfs, dedicated outbound network, memory/CPU/PID limits and an init process. No `SYS_ADMIN`, custom seccomp profile or host security changes are needed. This removes Chromium's additional internal sandbox: a browser exploit may compromise the renderer process and other in-flight jobs in this container. The per-job network filter is application-level protection, not containment for a compromised process. Do not mount credentials, host sockets or API files into this container.
4. Deploy the renderer first. Startup and `/health` actually launch Chromium; logs explicitly report the disabled Chromium sandbox. Verify `healthy`, no published ports, dedicated network, UID 1000, capabilities dropped and no API environment secrets. Local browser execution keeps its sandbox unless the renderer-specific flag is explicitly set; a launch failure never disables it automatically.
5. Add existing named volume `paperlesspaper-dev-renderer-socket` to API (dev) at `/run/paperlesspaper-renderer`; add `RENDER_SERVICE_SOCKET` above. Prefer a read-only API mount where the deployment platform supports it. Dokploy 0.30.10 Application mounts omit `ReadOnly`, so this development rollout uses a read/write mount containing only the socket. The trusted API could therefore remove/replace the socket; this is an availability/integrity limitation, not a read-only filesystem guarantee. The renderer receives no API files or credentials through this volume. Deploy the API revision. Both API Dockerfiles now omit Chromium.
6. Exercise API → socket → renderer with a benign page; compare rendered PNG with the prior render pipeline; verify a private-network target fails. Check error behavior with unavailable renderer. Re-enable API autodeploy only once the environment is fully configured.

Rollback: keep the renderer/socket mounted and revert the API to its previous image, or remove the new env/mount and restore the previous API image. Do not remove the named volume until it is no longer referenced. Production uses the separate configuration and cutover sequence below; multi-host scheduling needs a different transport/placement design.

## Production preparation and cutover (single Dokploy host)

Use `tools/paperlesspaper-renderer/compose.production.yml` as a separate Compose service in **paperlesspaper / production**. It uses the same tested container restrictions as development but its own named volume, `paperlesspaper-prod-renderer-socket`, and its own Compose-scoped outbound network. Never share the development socket volume. Leave automatic deployment disabled while preparing the release. Pin the renderer to the reviewed Git commit; switch to the merged release revision in a coordinated deployment later.

The renderer can be prepared and health-checked before any production API change. Do not attach a public domain, publish a port, add persistent credentials, or connect it to the database/Dokploy network. Use the same Docker host as the production API; the named socket volume is local to that host. If the API is a Swarm service, verify or pin its placement on that host before cutover. Do not scale or schedule the API across hosts with this local-socket configuration.

API startup checks the renderer socket and restores recurring schedules before opening the HTTP listener. Both API Dockerfiles include the worker-aware `/health` check. A missing renderer mount or failed scheduler registration therefore fails startup instead of silently accepting traffic.

Before merging a branch that automatically deploys the production API:

1. Start the production renderer and verify health plus a benign render through its socket. Check that a private/metadata URL is rejected. Record the deployed commit, image ID and host.
2. Record the current production API image, Git revision and complete environment/mount configuration. Preserve every existing entry when editing; a virtualized editor's visible DOM text is not a full environment backup.
3. Configure a start-first update with one task at a time, automatic rollback on failure, and at least a 300-second monitoring window covering the image healthcheck startup period. Keep the current replica until the replacement is healthy. Mount `paperlesspaper-prod-renderer-socket` at `/run/paperlesspaper-renderer` in the API and add `RENDER_SERVICE_SOCKET=/run/paperlesspaper-renderer/renderer.sock`. Prefer read-only; Dokploy Application mounts may only support read/write, as documented above. This step recreates the API container and belongs to the actual cutover, not renderer-only preparation.
4. Deploy the reviewed API revision, verify API → renderer, a denied private target, and failure behavior when the renderer is unavailable. Keep the prior device image on failed jobs. Deploy the web client after the account-security API is available; test Auth0/SES with a dedicated account as described in `docs/account-security.md`.
5. Restore the intended API deployment policy only after verification. Keep renderer updates coordinated with the API protocol.

For rollback, redeploy the recorded previous API image with its previous environment and mounts. Keep the renderer and its socket volume until no API references them. Preparing or starting the standalone renderer does not route production requests to it; that happens only after the API mount/environment cutover.

## Build and checks

From repository root:

```sh
docker compose -f tools/paperlesspaper-renderer/compose.development.yml build
node_modules/.bin/vitest run --root packages/paperlesspaper-api tests/unit/renderTransport.test.ts tests/unit/render.service.test.ts tests/unit/render.failure.test.ts tests/unit/renderNetwork.test.ts tests/unit/renderAssetCache.test.ts --maxWorkers=2
```

The renderer Docker build uses only public dependencies and a narrow context allowlist. It does not copy the API `.env`, Auth0 token caches, private npm configuration or cloud credentials. Dependency versions are locked independently from the API. Install locally with `PUPPETEER_SKIP_DOWNLOAD=true npm ci --prefix tools/paperlesspaper-renderer`.

The experimental namespace/seccomp configuration was removed in favor of the container-isolation approach. If Dokploy still points at `compose.namespace-test.yml`, change it back to `tools/paperlesspaper-renderer/compose.development.yml` before deploying.

## Cronjob release checks

CI runs the slideshow, device schedule and scheduler regression suites, including real MongoDB claim persistence and real Redis worker replacement. Locally use disposable `CRONJOB_TEST_MONGODB_URL=mongodb://127.0.0.1:27017/paperless-cronjob-test-local` and `CRONJOB_TEST_REDIS_URL=redis://127.0.0.1:6379`. Tests cover overdue catch-up, duplicate prevention across workers, failed-render retries, stale claim recovery, and recurring schedule reconciliation. An interrupted processing claim can take 15 minutes to become reclaimable; a restart does not guarantee an immediate image refresh.

After the API deploy, verify `/health`, `schedule:papersCronjob` at 240000 ms and `schedule:deviceUpdateScheduleCronjob` at 600000 ms, recent completed jobs and their per-device errors, no unexpected backlog, and expired processing claims. A completed BullMQ job alone is insufficient: individual device errors are returned in `meta.errors`. Recheck the next scheduled executions without forcing production uploads.
