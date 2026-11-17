# Paperlesspaper API tests

## Requirements

- Node.js with yarn
- Local MongoDB running on `mongodb://localhost:27017/paperlesspaper-api`
- `schemathesis` installed and available on PATH (for the schema test)

## Run tests

From `packages/paperlesspaper-api`:

```
yarn test tests/integration
```

To run only the Schemathesis test:

```
yarn test tests/integration/schemathesis.test.ts
```

## What the integration tests do

- Spin up the app in test mode
- Connect to local MongoDB
- Seed an organization, user, device, and paper per test
- Record responses to JSON files under `test-results/`

## Seed data

Each integration test seeds the following and keeps the ids available via
`getSeedData()`:

- `organizationId`
- `userId`
- `deviceId` (device serial)
- `deviceObjectId` (MongoDB ObjectId)
- `paperId`

## Output artifacts

Response logs are written to:

```
../../test-results/<suite>-responses-<runId>.json
```

Schemathesis logs are written to:

```
../../test-results/schemathesis-<suite>-<runId>.log
```

## Environment variables

- `MONGODB_URL`: Override the MongoDB connection string.
- `TEST_RESULT_DIR`: Override where response logs are written.
- `TEST_RUN_ID`: Override the run id used in filenames.
- `SCHEMATHESIS_SCHEMA_URL`: Override the schema URL used by Schemathesis.
- `API_KEY_ADMIN`: When `true`, API-key auth is treated as admin during tests.

## Notes

- IoT API calls are mocked during tests to avoid external dependencies.
- Auth0, email, Google Calendar, render, and multipart uploads are mocked for schema tests.
- Schemathesis runs the `examples` phase only; other phases are disabled.
- Schemathesis warnings are suppressed via `--warnings=off`.

## Battery notifications

The production BullMQ scheduler checks OpenPaper 7/13 batteries every four hours.
Account email and push preferences are explicit opt-ins, stored separately from
legacy notification defaults. Only fresh readings below 4300 mV without USB
power or charging qualify. Each account/device/channel has a durable 48-hour
cooldown and an atomic delivery lease; failures or skipped sends do not start
the cooldown. Email and push transports are mocked in automated tests.

The receipt concurrency tests additionally require an isolated local MongoDB:

```sh
BATTERY_TEST_MONGODB_URL=mongodb://127.0.0.1:27017/paperless-battery-test-local \
  yarn test tests/integration/batteryDelivery.persistence.test.ts
```

This test refuses non-local hosts and other database-name prefixes, and drops
its disposable database after the run. The cronjob itself skips delivery outside
production. No migration of legacy default-on settings or device data is needed.
