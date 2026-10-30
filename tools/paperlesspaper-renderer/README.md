# Isolated paperlesspaper renderer

Chromium, per-render filtering proxies, readiness checks and the public asset cache run in this container. The API keeps dithering, stored-image reuse, database access and uploads. The render result includes the original PNG bytes, dimensions, diagnostics and `epdoptimize` metadata.

The service listens only on `/run/paperlesspaper-renderer/renderer.sock` (0600, UID 1000). Mount the named volume in the API **read-only**, at the same path, and set `RENDER_SERVICE_SOCKET=/run/paperlesspaper-renderer/renderer.sock`. Unix sockets can be connected to through a read-only mount. No TCP port, shared database network, API key or other persistent credential is needed. Both containers must run on the same Docker host as UID 1000. The Docker volume stores only the socket, not images or job payloads. Do not mount it in unrelated services.

Production API containers refuse browser rendering if the socket is missing; a broken renderer never causes a local Chromium fallback. Local development and tests without `NODE_ENV=production` can still use a locally installed browser via `CHROME_BIN`. Browser rendering errors retain the existing device image through the existing API error path. Two concurrent jobs are supported; excess requests return 503 rather than accumulating an unbounded queue. Requests are limited to 16 MiB, responses to 24 MiB, and jobs to 60 seconds. A client disconnect/deadline closes that job's browser context and proxy. Normal per-job data, including any content a plugin needs, is still transmitted; do not put unrelated service credentials in a render payload.

## Development rollout (single Dokploy host)

1. Pause automatic API deployment during the coordinated rollout. Keep its current image until the renderer passes health and render checks.
2. Create a **Docker Compose** service in paperlesspaper/development from the same Git revision as the API. Compose path: `tools/paperlesspaper-renderer/compose.development.yml`. Use Compose, not a Swarm stack: build and per-container restrictions are required. No domain or port mapping.
3. The supplied configuration grants **no additional Linux capabilities** and keeps Docker's default seccomp/AppArmor policies. Chromium runs as non-root with its own sandbox. If startup reports a namespace permission error, inspect the host's audit logs and test the specific namespace operations before adding a narrowly scoped renderer policy. Do not add `SYS_ADMIN`, `--no-sandbox`, an unconfined profile or global user-namespace/AppArmor changes as a fallback. The container has a read-only root, bounded tmpfs, dedicated outbound network, memory/CPU/PID limits and an init process.
4. Deploy the renderer first. Its startup and `/health` check actually launch sandboxed Chromium. Verify `healthy`, no published ports, dedicated network, UID 1000 and no API environment secrets.
5. Add existing named volume `paperlesspaper-dev-renderer-socket` to API (dev) at `/run/paperlesspaper-renderer`, read-only; add `RENDER_SERVICE_SOCKET` above. Deploy the API revision. Both API Dockerfiles now omit Chromium.
6. Exercise API → socket → renderer with a benign page; compare rendered PNG with the prior render pipeline; verify a private-network target fails. Check error behavior with unavailable renderer. Re-enable API autodeploy only once the environment is fully configured.

Rollback: keep the renderer/socket mounted and revert the API to its previous image, or remove the new env/mount and restore the previous API image. Do not remove the named volume until it is no longer referenced. This configuration is for development; production/multi-host scheduling needs its own explicit rollout and placement strategy.

## Build and checks

From repository root:

```sh
docker compose -f tools/paperlesspaper-renderer/compose.development.yml build
node_modules/.bin/vitest run --root packages/paperlesspaper-api tests/unit/renderTransport.test.ts tests/unit/render.service.test.ts tests/unit/render.failure.test.ts tests/unit/renderNetwork.test.ts tests/unit/renderAssetCache.test.ts --maxWorkers=2
```

The renderer Docker build uses only public dependencies and a narrow context allowlist. It does not copy the API `.env`, Auth0 token caches, private npm configuration or cloud credentials. Dependency versions are locked independently from the API. Install locally with `PUPPETEER_SKIP_DOWNLOAD=true npm ci --prefix tools/paperlesspaper-renderer`.

## Narrow namespace test

`compose.namespace-test.yml` is an explicit test configuration, separate from the default deployment. It uses the default seccomp policy of the observed Docker Engine 28.5.0 (`moby/profiles/seccomp v0.1.0`), with only these additional allowances:

- `clone`: the existing flag mask also permits user, PID and network namespace creation. Mount, cgroup, IPC and UTS namespace flags remain blocked.
- `unshare`: only the seven exact combinations of `CLONE_NEWUSER`, `CLONE_NEWPID` and `CLONE_NEWNET` are allowed. `setns`, `clone3`, mount and all other syscall rules are unchanged.

At the same time the test drops **all** Linux capabilities and enables `no-new-privileges`. AppArmor remains `docker-default`; no host policy or global sysctl is changed. Allowing namespace creation exposes that kernel functionality to the container, so review the scoped exception before selecting this Compose path in Dokploy and deploying. Failure must not trigger an automatic fallback to a wider policy. The test restarts at most three times.

Run `node tools/paperlesspaper-renderer/security/verify-profile.mjs` to verify both the flag restrictions and that the remainder exactly matches the pinned upstream profile (SHA-256). `security/provenance.json` records the source, and `security/LICENSE.moby` preserves its license.

Development baseline on 2026-10-30: the image built successfully; Chromium failed with namespace EPERM under the unchanged Docker policy. User, user+network and user+PID namespace probes all failed. The container was UID 1000, effective capabilities zero, Seccomp mode 2, AppArmor `docker-default (enforce)`. Host user namespaces are enabled, with Ubuntu's AppArmor user-namespace restriction also enabled. This identifies a policy restriction but does not alone distinguish Seccomp from AppArmor. The baseline test was stopped; the API was not switched over.
