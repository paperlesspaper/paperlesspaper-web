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
