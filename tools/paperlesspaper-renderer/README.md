# Isolated paperlesspaper renderer

Chromium, per-render filtering proxies, readiness checks and the public asset cache run in this container. The API keeps dithering, stored-image reuse, database access and uploads. The render result includes the original PNG bytes, dimensions, diagnostics and `epdoptimize` metadata.

The service listens only on `/run/paperlesspaper-renderer/renderer.sock` (0600, UID 1000). Mount the named volume in the API **read-only**, at the same path, and set `RENDER_SERVICE_SOCKET=/run/paperlesspaper-renderer/renderer.sock`. Unix sockets can be connected to through a read-only mount. No TCP port, shared database network, API key or other persistent credential is needed. Both containers must run on the same Docker host as UID 1000. The Docker volume stores only the socket, not images or job payloads. Do not mount it in unrelated services.

Production API containers refuse browser rendering if the socket is missing; a broken renderer never causes a local Chromium fallback. Local development and tests without `NODE_ENV=production` can still use a locally installed browser via `CHROME_BIN`. Browser rendering errors retain the existing device image through the existing API error path. Two concurrent jobs are supported; excess requests return 503 rather than accumulating an unbounded queue. Requests are limited to 16 MiB, responses to 24 MiB, and jobs to 60 seconds. A client disconnect/deadline closes that job's browser context and proxy. Normal per-job data, including any content a plugin needs, is still transmitted; do not put unrelated service credentials in a render payload.

## Development rollout (single Dokploy host)

1. Pause automatic API deployment during the coordinated rollout. Keep its current image until the renderer passes health and render checks.
2. Create a **Docker Compose** service in paperlesspaper/development from the same Git revision as the API. Compose path: `tools/paperlesspaper-renderer/compose.development.yml`. Use Compose, not a Swarm stack: build and per-container restrictions are required. No domain or port mapping.
3. The supplied configuration gives **only this renderer** `SYS_ADMIN`, following Puppeteer's Docker sandbox requirements. This is a broad Linux capability; it is not an application permission. Review/approve this exception before deployment. Chromium still runs as non-root with its own sandbox; no `--no-sandbox`, privileged container, host networking, Docker socket or unconfined security profiles. The container has a read-only root, bounded tmpfs, dedicated outbound network, memory/CPU/PID limits and an init process. Host-specific AppArmor restrictions may require a narrower host policy; do not disable AppArmor globally if the sandbox still fails.
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
