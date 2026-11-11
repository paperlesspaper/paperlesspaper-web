# Renderer security

Every render uses a fresh Chromium browser context and a loopback-only filtering
HTTP proxy. Closing the context discards cookies, localStorage, browser cache, workers and
popups. The proxy and its connections are closed even when rendering fails.

## Network policy

- Initial URLs must use HTTP or HTTPS without embedded credentials. `file:`,
  `data:`, `javascript:` and other initial URL schemes are rejected.
- Browser HTTP, HTTPS, WebSocket and secure WebSocket requests go through the proxy,
  including redirects, subresources, workers and popups. Chromium's implicit
  localhost proxy bypass is explicitly disabled.
- DNS A/AAAA results are checked before connection. If any result is private,
  loopback, link-local, reserved, multicast, a transition address, or a known
  platform metadata address, the destination is rejected. Only public IPv4 and
  global-unicast IPv6 destinations are accepted.
- The socket uses the already-checked addresses through a pinned lookup function;
  it does not resolve DNS again. IPv4/IPv6 connection fallback is retained.
- HTTPS uses CONNECT tunnels; Chromium still validates server certificates.
- QUIC is disabled and WebRTC is configured to disallow non-proxied UDP.
- Embedded `data:`/`blob:` resources remain supported. Page request interception
  rejects other resource schemes. Downloads are denied.
- A blocked main navigation fails the render, allowing the existing callers to
  retain the previous image. Blocked optional subresources do not fail the entire
  render.

This is a browser network policy, not an OS firewall. The dedicated renderer
uses a separate outbound Docker network with no API/database network attachment.
A browser exploit is outside the proxy's security boundary; container isolation
and the deployment restrictions below remain necessary.

## Local development

Public app URLs work without additional configuration. To render a local apps
server, explicitly allow its exact origin (scheme, hostname and port):

```sh
PAPERLESSPAPER_APPS_URL=http://localhost:3000
RENDER_ALLOWED_PRIVATE_ORIGINS=http://localhost:3000
```

Multiple development origins can be separated by commas. CONNECT tunnels carry
only host and port, so a development exception also permits TLS/WebSocket tunnels
to that same host and port regardless of scheme. These exceptions apply to all
requests within the render, so only list trusted development services.
Setting `RENDER_ALLOWED_PRIVATE_ORIGINS` in `NODE_ENV=production` fails closed.
An apps URL override alone never disables the network policy. Remapping matches
the exact `https://apps.paperlesspaper.de` origin, not a string prefix.

Private intranet URLs, local files and persistent logins across render jobs are
intentionally no longer supported by default.

## Container isolation and deployment

Production API images no longer include Chromium. Browser jobs cross a private Unix socket into the dedicated renderer container; if the socket is unavailable, production rendering fails without falling back to a local browser. Image dithering, saved-image reuse, credentials and database/upload access remain in the API.

The dedicated container explicitly sets `RENDERER_DISABLE_CHROMIUM_SANDBOX=true` and launches Chromium with `--no-sandbox`. This is the tested deployment choice for hosts that reject Chromium namespace creation. The container is the isolation boundary: UID 1000, all capabilities dropped, no-new-privileges, Docker's default seccomp/AppArmor, read-only root, bounded temporary filesystems, resource limits and an init process. It has no public port, no API/database network, no Docker socket and no persistent API/cloud credentials. A browser exploit can still compromise the renderer process and other concurrent jobs; the application-level network filter does not contain a compromised browser process.

Local browser execution retains the Chromium sandbox unless the explicit renderer flag is set. A launch failure never disables the sandbox automatically. No SYS_ADMIN, host policy changes or custom seccomp profile are required by the current deployment.

See [renderer deployment instructions](../tools/paperlesspaper-renderer/README.md) for the development validation, separate production socket volume, same-host placement, coordinated API cutover and rollback. Production preparation alone does not establish API-to-renderer connectivity.

## Verification

From `packages/paperlesspaper-api`:

```sh
npm test -- tests/unit tests/integration/slides.service.test.ts
npm run test:render-browser
RENDER_LIVE_SMOKE=true npm run test:render-browser
```

The browser suite requires an installed Puppeteer headless shell, or a compatible
executable provided through `CHROME_BIN`, with sandbox support. Default tests use
only local disposable fixtures. `RENDER_LIVE_SMOKE=true` additionally fetches
`https://example.com` and renders the public paperlesspaper calendar integration;
it does not upload an image or modify a device.

Coverage includes pixel-for-pixel comparison against a direct, unfiltered browser
reference in portrait and landscape, custom CSS, scripts, network/data/blob
images, timezone, EPD optimization metadata, plugin INIT and legacy calendar
messages, ordinary websites without readiness markers, allowed redirects and
WebSockets, per-job storage isolation, and blocked local/file/metadata targets
through navigation, redirects, subresources, frames, workers, popups and sockets.
Unit tests cover DNS rebinding, mixed DNS answers, IPv4 alternate notation and
IPv6 special ranges.

## Shared public asset cache

`renderAssetCache.ts` adds a process-local RAM cache in the renderer Node process;
it is not another container, persistent disk storage, or a shared browser session.
Only GET requests for scripts, styles, fonts and images under the exact apps
origin's `/_next/static/` path are eligible. `PAPERLESSPAPER_APPS_URL` also remaps
this root, including an optional path prefix. Queries, encoded paths, HTML, JSON,
API calls and other hosts are excluded. Cookie, authorization, range, conditional
and cache-control request headers bypass it.

On a miss, a dedicated Node HTTP(S) request fetches the asset **anonymously**,
without forwarding browser cookies, authorization, referrers or other headers.
This request does not use the Chromium proxy: it directly uses the same
`resolveRenderAddresses` checks and a pinned lookup for the connection. HTTPS
certificate checks stay enabled. It does not follow redirects. Private-address
exceptions still require the exact development origin and are forbidden in
production; different exception policies have separate cache keys.

Only complete HTTP 200 responses with the correct asset MIME type and explicit
`public`, `immutable` and positive `max-age` are stored. `private`, `no-cache`,
`no-store`, `Set-Cookie`, partial responses, compressed bodies and `Vary` other
than `Accept-Encoding` are rejected. Downloads request the identity encoding.
`Age`, `Date` and `s-maxage` reduce freshness. CORS, CORP and CSP response headers
are retained, and replay updates `Age`. Next's immutable assets use this public
cache contract; see the [Next.js documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).

Limits: 64 MiB of cached body data, 512 entries, 2 MiB per asset, at most 16
concurrent cache downloads, four seconds per download including DNS, and at most
one hour of freshness. Entries are evicted by least recent use. Temporary download
buffers and response headers consume additional, bounded memory. Concurrent
requests for the same asset share the download. An unsuitable response, timeout,
full download queue or fetch failure falls back to the ordinary filtered browser
request; an unsuitable response may therefore be downloaded twice. No stale
entry is served on an error. Cache misses, hits, coalescing, bypasses and served
bytes appear in `diagnostics.assetCache`.

`RENDER_STATIC_CACHE_DISABLED=true` bypasses the cache without disabling the
network guard or browser isolation. Each renderer process/container maintains its own
cache; restarts start cold. Workers and popups retain the filtering proxy and do
not gain this page-level optimization. Cookies, localStorage and dynamic data
remain isolated in disposable browser contexts.

Cache verification on 2026-09-27: 379 tests passed in the current workspace, including both live smoke
tests, cache policy/bounds/anonymous-fetch tests and pixel-identical cached versus
uncached screenshots in both orientations with clean per-job cookies/storage,
credential-bearing request bypass and fallback for private/no-store responses.
There are 52 cache-specific tests (48 unit tests and four browser tests).
The cache module passed a strict TypeScript check. No deployment was performed.

Verification on 2026-09-27: 316 tests passed across all 23 unit test files, the
slideshow service suite and the browser suite (including both live smoke tests).
The network module also passed a strict TypeScript check. The Linux probe above
was additional to this test count; it tested the renderer in isolation, not a
full API deployment.
