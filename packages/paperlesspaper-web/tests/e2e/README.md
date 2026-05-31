# Playwright E2E

## Blank Local Database

Use a local API and a fresh Mongo database for an isolated run:

```sh
yarn test:e2e:blank-db
```

The script sets `PLAYWRIGHT_USE_LOCAL_API=1`, points the frontend at
`http://localhost:5002/v1/`, starts `packages/paperlesspaper-api`, and uses a
timestamped MongoDB name by default. Override the database explicitly with:

```sh
PLAYWRIGHT_MONGODB_URL=mongodb://127.0.0.1:27017/paperlesspaper-e2e-my-run yarn test:e2e:blank-db
```

The API still needs the normal local/API environment values for Auth0 and other
services. By default the Playwright API server loads
`../paperlesspaper-api/.env.production`; override that with
`PLAYWRIGHT_API_ENV_FILE`.

## Physical Device Registration

The safe device test uses `epd7-b43a459a1b98`, skips Wi-Fi provisioning with a
development-only Playwright flag, and mocks the registration response. It does
not activate the device:

```sh
yarn test:e2e:device
```

Actual registration of the physical device is deliberately skipped unless both
of these are true:

```sh
PLAYWRIGHT_USE_LOCAL_API=1 PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:blank-db:device
```

To use a different device:

```sh
PLAYWRIGHT_REAL_DEVICE_ID=epd7-yourdevice yarn test:e2e:blank-db:device
```

Deleting a real ePaper device calls the backend unlink/reset path, so cleanup is
only run when explicitly requested:

```sh
PLAYWRIGHT_DELETE_REAL_DEVICE_AFTER=1 PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:blank-db:device
```

## Physical Frame Image Update

The physical frame test sends a generated unique high-contrast image through the
single image editor, saves the expected PNG and webcam photos, waits 50 seconds,
and verifies via the webcam that the ePaper display matches the expected test
card. It defaults to `epd7-b43a459b7ec4`, but the device ID stays configurable:

```sh
PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:physical-frame
```

To use a different frame or bypass device search:

```sh
PLAYWRIGHT_REAL_DEVICE_ID=epd7-yourdevice PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:physical-frame
PLAYWRIGHT_REAL_DEVICE_OBJECT_ID=your-mongodb-object-id PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:physical-frame
```

If the ePaper refresh needs longer than the default three minutes:

```sh
PLAYWRIGHT_REAL_DEVICE_UPDATE_WAIT_MS=300000 PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:physical-frame
```

To change the fixed wait between sending and taking the webcam verification
photo:

```sh
PLAYWRIGHT_REAL_DEVICE_DISPLAY_SETTLE_WAIT_MS=50000 PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 yarn test:e2e:physical-frame
```
