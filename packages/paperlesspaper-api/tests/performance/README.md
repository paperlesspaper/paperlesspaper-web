# Renderer performance benchmark

Run from `packages/paperlesspaper-api`:

```sh
npm run benchmark:render
```

This compares the working-tree renderer with `render.service.ts` from Git HEAD.
Use `RENDER_BENCHMARK_BASE_REF=<commit>` to select the version before the security
changes. Both variants use the currently installed dependencies and supporting
modules, so this is a renderer comparison, not a reconstruction of a historical
deployment. The script temporarily creates instrumented copies beside the source
file and removes them on exit; it does not edit production code.

Results are written to `output/render-performance/<timestamp>/results.json` in
the repository root. Set `RENDER_BENCHMARK_OUTPUT` to override the directory.
The JSON contains individual samples, median/p95, render stages, asset requests,
payload bytes, throughput and approximate resource observations.

To include sequential smoke benchmarks against the publicly hosted integrations:

```sh
RENDER_BENCHMARK_LIVE=true npm run benchmark:render
```

The live cases use Calendar, Google Calendar with generated appointments and no
OAuth credentials, and example.com. They do not access user calendars. All
concurrency testing uses a separate local fixture server. Live endpoint latency
can vary independently of renderer changes.

To compare the current protected renderer with its shared asset cache disabled
versus enabled (both variants use the same current source):

```sh
RENDER_BENCHMARK_COMPARE_CACHE=true RENDER_BENCHMARK_LIVE=true npm run benchmark:render
```

In this mode `baseline` means cache disabled and `hardened` means cache enabled.
Fixtures use the trusted development apps origin and query-free Next-style
asset paths. The results include per-render `assetCache` counters. The public
apps origin is restored before live cases. For ordinary Git comparisons the
original fixture paths remain unchanged. The two modes are distinct experiments:
the cache mode can speed up cold requests through its separate anonymous fetches
as well as through shared cache hits.

## Interpretation

- Each latency scenario excludes two warmups per variant and alternates the
  order of old/new runs. Wall time includes browser-context and proxy cleanup.
- The small fixture has two assets. The rich fixture has 16 PNGs, four scripts
  and two stylesheets. Its optional 80 ms delay is applied to every asset response;
  it is not a bandwidth limit or a simulation of all Internet protocols.
- Repeated pages allow the old renderer to reuse its shared browser cache.
  Fresh URLs force both variants to fetch assets. Each protected render has a
  separate browser context and therefore a separate cache.
- Local fixtures use HTTP/1.1. Connection limits and parallelism can differ from
  real HTTPS/HTTP2 endpoints. Do not extrapolate fixture throughput to production.
- Browser startup is sampled separately. The browser stays running for the
  main timing scenarios. Startup samples do not clear OS filesystem caches.
- Resource observations run separately from the main timing samples. Browser CPU
  sampling can miss processes that exit between polls; summed RSS counts shared
  memory more than once. Node values include Vitest and benchmark instrumentation.
  These are diagnostics, not container sizing or API capacity measurements.
- This measures `generateImageFromUrl`, not the full API pipeline: database work,
  uploads, device delivery and subsequent dithering are excluded. A local macOS
  run does not verify Linux sandbox configuration or production performance.
- Check failure counts before interpreting timings. A quickly failed render is
  not a successful fast render. There is deliberately no fixed speed threshold.

The benchmark is skipped in ordinary Vitest runs. It requires the local Chromium
installation used by Puppeteer (or `CHROME_BIN`), Git, Node and `ps`.
