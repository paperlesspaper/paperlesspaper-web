# PR 166 security review

Reviewed on 2026-09-22 against `main` at
`68ff87ba41ba5490781a3a7f697a2b0359c1ab65`. The merge preserves main's calendar
authorization, preview initialization, and icon-loading timeout fixes.

## Changes made during review

- **Unconfirmed device claims:** ordinary registration no longer sends an IoT
  reset for an active device missing from MongoDB. Reset/timeout/unclaimed
  statuses no longer detach the previous owner's assignment. Only a nonempty
  organization-specific IoT key authorizes completion. Support deactivation
  remains a separate admin/support operation.
- **Delayed takeover responses:** capture the assignment before asking IoT for
  proof, check it before cleanup and after the asynchronous image-cache operation,
  and condition deletion on the original assignment ID and organization. A
  changed assignment returns 409. Duplicate-key completion is idempotent only
  for the same target organization. Paper cleanup is also organization-scoped.
- **Restricted integration access:** `onlyself` members cannot create push
  grants or use existing connections. The shared authorization helper is also
  used for grant exchange, private previews, and worker execution.
- **Iframe credentials:** reject invalid, opaque, credential-bearing, and
  mismatched origins. Require HTTPS except for loopback development. Every
  outgoing message uses an exact target origin; incoming messages require both
  the expected origin and iframe window. Pending grants are not delivered after
  the component is closed or its authorization callback changes.
- **Signed assets:** accept only the five supported paper asset suffixes; the
  API's JSON-download mode accepts only `editable.json`. Arbitrary suffixes and
  path-like inputs are rejected before storage signing/fetching. This is input
  hardening, not a claim that an S3 traversal exploit was demonstrated.
- **Continuous checks:** add the web unit suite, API unit suite, and disposable
  MongoDB ownership regressions to the existing PR workflow.

The review also checked tenant-scoped device logs, sanitization of editable-image
errors, cancellation/deadlines, native URL forwarding, and the release scripts.
The fixes above have regression coverage; no additional blocking finding in the
changed application code remained in this pass.

## Validation

- Web: 197 tests in 27 suites passed (including the regression follow-up below).
- API: 214 tests in 22 suites passed, including 31 tests against a disposable
  local MongoDB database with IoT/S3 mocked.
- Web TypeScript: `tsc --noEmit --incremental false` passed.
- Swift source parsing, iOS plist/project linting, Fastlane Ruby syntax, workflow
  YAML parsing, and `git diff --check` passed.
- A heuristic scan of added lines found no private keys or common literal token
  formats. This does not replace a dedicated secret or dependency audit.

Run from each respective package directory:

```sh
# packages/paperlesspaper-web
../../node_modules/.bin/vitest run --silent
../../node_modules/.bin/tsc --noEmit --incremental false

# packages/paperlesspaper-api
REGISTRATION_TEST_MONGODB_URL='mongodb://127.0.0.1:27017/paperless-registration-test-review' \
  ../../node_modules/.bin/vitest run tests/unit tests/integration/deviceRegistration.persistence.test.ts --silent
```

## Open findings outside the PR changes

These pre-existing dependencies prevent treating this review as a complete
production security sign-off:

1. **High priority: JWT audience validation in the shared API package.** The
   locally installed `@internetderdinge/api` 1.229.55 configures JWKS, issuer, and
   RS256 in `src/middlewares/auth.ts`, but no `audience`. Tokens signed by the
   correct issuer must also be restricted to the intended API. Fix and publish
   the shared package, then test valid, missing, and wrong audiences through the
   actual authentication middleware. Its `requiredRights` argument also needs
   review: the active middleware does not evaluate it. This PR's organization
   membership/role tests do not exercise real JWT verification or certify every
   shared route's authorization.
2. **IoT client deadline and logging.** The same package's
   `src/iotdevice/iotdevice.service.ts` activation request has no explicit Axios
   timeout/abort and logs the raw caught error, which can contain authorization
   headers. The PR normalizes client-facing errors but cannot sanitize a log
   already written inside that dependency. Add a server-side deadline and
   sanitized logging in the shared package.
3. **IoT ownership protocol and hardware.** A normal button press can still
   confirm an unwanted pending claim under the supplied IoT protocol. Elapsed
   time or a client assertion that Wi-Fi is connected is never ownership proof
   in this API; completion trusts the IoT organization's key. MongoDB and IoT
   changes are not a distributed transaction. The new race regressions prevent
   replacing a changed local assignment with a late response, but do not prove
   atomicity of every concurrent physical claim. Claim-specific confirmation and
   proof generations require upstream work. Recheck real iOS/Android BLE
   permissions, cold-start callbacks, and non-destructive Wi-Fi changes before
   making an end-to-end release claim.

No production database, real Auth0 account, IoT service, or physical frame was
used in this review run. Native checks were source/syntax checks and web tests,
not signed app builds or hardware tests.

## Regression follow-up

A subsequent review reproduced and fixed a side effect in the iframe grant
guard: ordinary parent renders recreated callbacks, invalidating a pending
grant. The real modal now keeps callbacks stable across resize and mutation-state
renders, while changing the paper or integration endpoints still invalidates
the request. Tests cover both successful delivery after resize and refusal after
a same-origin settings-page change.

An assignment-race 409 now shows a retry message, rather than the legacy
"already registered" screen and reset link. Legacy already-registered responses
retain their previous behavior.

GitHub run `35669365876` passed all 408 then-existing unit/database tests and 59
browser tests. Its two device-settings failures (desktop/mobile) expected an
obsolete success message already changed on `main`; the artifact showed the
saved values and current success notice. The browser assertion now checks that
notice, retaining the submitted-payload and reload/persistence assertions.

Intentional compatibility restrictions remain: non-loopback HTTP settings pages
are refused, restricted members lose push access, unsupported signed-asset kinds
return 400, and an unconfirmed orphan is no longer automatically reset. No
further functional regression was identified in this pass. Native hardware and
upstream ownership-protocol limits listed above still apply.
