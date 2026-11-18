# Layout integration

The `codex/layout-integration-pr` branches in `paperlesspaper-web`,
`paperlesspaper-openintegration` and `paperlesspaper-integrations` implement a shared
layout with two to four existing contents. There are no database migrations.

Select **Layout** in the integration picker. Choose an image or integration per named
area, a preset (columns/rows/grid) or custom HTML/CSS, and a processing profile per area.
The first-area ratio, gap, orientation, photo fit and focal point are editable.
The Live preview needs an updated Open Integration runtime. **Render display preview**
uses the API renderer, also supports legacy readiness markers, and shows the actual
per-area processed result. A successful current preview is required before sending.

## Runtime and rendering

The stored paper has `kind: layout`. `meta.regions` contains `{ id, paperId, processing,
fit, focalX, focalY }`; other fields are `layout`, `ratio`, `gap`, `html`, `css`, `color`,
and the existing device/orientation settings. Signed URLs and resolved data are never
saved into layout configuration.

`POST /papers/layout-preview?organization=…` resolves references; `mode=render` additionally
renders/optimizes a preview, with `frameKind` and `orientation`. The strict query rejects
`deviceId` so device authorization cannot override the organization check. The resolver
checks every referenced paper against the same organization before loading data/signing
image URLs, rejects nested layouts/slides/playlists/printers, and obtains original images.
Google Calendar uses strict error handling for layout renders. Other integrations keep
their existing provider-side fetches and data contract.

A layout page receives fresh per-region render payloads. It uses a shadow root for custom
HTML/CSS, creates a new iframe per region per render, checks message source/origin and
render ID, and waits for image decoding, children, fonts and layout. Child errors and
timeouts fail the whole frame, retaining the previous display image. HTML allows static
markup and CSS with named `<paperless-slot>` elements; scripts/event handlers/external
CSS resources are rejected. Slots must be opaque, rectangular and non-overlapping.

Region metadata is returned with the screenshot and validated across the renderer socket.
The background and each unprocessed crop are optimized separately using the target palette.
The final image is assembled without a second color pass and rotated once for the panel.
Server previews deliberately retain logical orientation. Disabled processing is allowed
only for regions already made of opaque device-palette colors.

## Build and rollout

1. Publish the complete tested `@paperlesspaper/openintegration` runtime to npm.
   The runtime now includes the existing calendar/settings helpers and layout support
   in one build. The provider pins version `0.2.0`; no vendor snapshots or addon are used.
2. Run `npm ci` in the provider to install the pinned package and generate shared assets,
   then deploy the provider with `applications/layout/` and updated shared assets.
3. Release/build the changed helpers package, then deploy API + renderer and the web app.
   They must use the matching layout/region protocol. Existing content types keep their
   existing rendering path.

Defaults use `https://integrations.paperlesspaper.de/layout/render.html`. For local or
staging use, configure API `LAYOUT_RENDER_URL` and web `REACT_APP_LAYOUT_RENDER_URL` to
that environment's provider. For local API rendering, allow that exact origin through
`RENDER_ALLOWED_PRIVATE_ORIGINS` as required by the existing renderer network policy.
Do not enable broad private-network access. Provider integrations which prohibit iframes
or never signal readiness cannot be embedded; the preview reports failure.

## Validation

- API unit tests: layout reference authorization, strict preview query, Google errors,
  region geometry, independent processing, panel rotation, logical preview orientation.
- API Chromium test `tests/browser/render.layout.test.ts`: cross-origin legacy iframe
  readiness, renderer transport, child failure and trusted-layout redirect rejection.
- Web `tests/unit/layoutEditor.test.tsx`: content selection, stale/untrusted messages,
  readiness gating and server-preview fallback.
- Shared runtime: HTML/CSS injection rejection, embedded INIT handshake/error semantics,
  and Chromium renders at 800×480, 480×800, 1600×1200, 1200×1600.

The API currently has pre-existing repository-wide TypeScript diagnostics (missing type
packages and existing model/API types). Compare these against the base before attributing
those failures to this feature. Web-app and shared-runtime typechecks should pass.

## Embedded compatibility and security checks

The shared runtime installs a capture-phase message guard before integration scripts
register their listeners. This also protects existing SDK closures and legacy listeners:
embedded INIT messages must match the parent window, origin, render ID and region ID.
Malformed slot contexts reject messages. The bridge's local legacy Google Calendar
message is allowed only from the frame itself. Non-embedded pages keep their existing
message handling. All helpers share the same runtime implementation; no export overrides are required.

URL-driven legacy contents retain their completed readiness marker; INIT-driven plugins
and Google Calendar start a fresh readiness cycle. Plugin settings are included in both
the render URL and the existing `meta.pluginSettings` payload contract.

Run the runtime browser suite against the actual packaged provider before rollout:
`LAYOUT_BROWSER_TESTS=1 LAYOUT_PROVIDER_DIR=/path/to/provider CHROME_BIN=/path/to/chrome npm test`.
This includes the foreign-sibling message regression and legacy readiness test.
