# Account sign-in and security

Email and password changes use the paperlesspaper account-security API, independently of profile settings. Deploy the API before deploying the web client. The existing `PAPERLESSPAPER_APP_URL` must point at the corresponding web deployment so email links open the correct environment (default: `https://web.paperlesspaper.de`).

## Authentication and credentials

The existing Auth0 application and Management API credentials are reused. Management access requires the existing user-read and user-update permissions. No Resource Owner Password grant is needed. The existing Universal Login callbacks and allowed web origins must support the application, including Capacitor callbacks for native apps.

The app requests `prompt=login` and `max_age=0`. Desktop uses an Auth0 popup; native apps use the system browser and return to `/account`. Only the intended action, account subject and start time are retained for the native redirect; passwords and ID tokens are not stored by this flow. The API verifies the ID token's signature, issuer, audience (the access token's `azp`), subject, expiry and a maximum authentication age of five minutes. API keys cannot access these security endpoints. Password recovery sends Auth0's standard reset email and does not need the forgotten password.

Database identities can change passwords. Primary Auth0 database accounts can change their account email. Social-only accounts show Google/Apple account management and their current email. Password strength/history policies continue to be enforced by Auth0; the local form requires 8–128 characters and matching entries.

## Email changes

Pending changes are stored in MongoDB's `AccountSecurity` model, separately from the Auth0 profile. The existing email stays active until confirmation. Tokens contain 32 random bytes; only SHA-256 hashes are stored. Links expire after 24 hours. Resend rotates the token and has a 60-second cooldown. Cancellation invalidates the link. Auth0/email writes are serialized per account with a recoverable two-minute lease; external calls have shorter timeouts.

The public `/confirm-email` page removes the secret fragment before telemetry initializes and requires an explicit confirmation button. Only POST applies the change. The API rechecks the token, expiry, email availability and account state, updates Auth0 to the verified new address, then removes the pending change and notifies the old mailbox. Password changes cancel pending email changes; confirmation also detects password resets performed through Auth0. Legacy profile POST/PATCH endpoints reject email changes and ignore unchanged email values from older clients.

Security mail uses the existing SES setup in `eu-central-1`, sender `notifications@wirewire.de`, and configuration set `memo-transactional`. Unlike the shared notification helper, confirmation delivery errors propagate, so a failed resend preserves the previously delivered link. Failure to deliver a security notification after a completed credential change is logged without secrets and does not incorrectly report that the credential change failed.

## Validation

- API tests: email lifecycle, expiry, reuse, conflict, cancellation, delivery failure, serialization, provider restrictions, password recovery invalidation, real signed-token reauthentication and route authorization.
- Web tests: independent dialogs, matching passwords, recovery, pending state, provider links, failed/wrong-account reauthentication and explicit email confirmation.
- Desktop/mobile browser checks use local synthetic authentication and API responses. They do not send real emails or change live Auth0 accounts.

A live smoke test should use a dedicated Auth0 test account and two controlled mailboxes, including a configured MFA factor. This remains a deployment-environment check; the unit/browser tests do not validate live tenant permissions, SES delivery, or a physical native-app callback.
