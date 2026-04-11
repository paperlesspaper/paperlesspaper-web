# @paperlesspaper/api

API backend (Node.js + Express + TypeScript) of [paperlesspaper](https://api.paperlesspaper.de)

## Requirements

- Node.js `>=24`
- Yarn

## Install

From the monorepo root:

```bash
yarn install
```

## Run locally

From `packages/paperlesspaper-api`:

```bash
yarn dev
```

Useful variants:

- `yarn dev:tunnel` to run against a Redis tunnel
- `yarn dev:prod` to run with production env values

## Test and lint

```bash
yarn test
yarn lint
```

## Notes

- Environment is loaded via `.env.<NODE_ENV>` (for example `.env.development`).
- Default local API port is `5002` in development scripts.

## Deploy on Dokploy

Recommended Dokploy setup for the GitHub repo:

1. Create an application from the repository root.
2. Choose Dockerfile deployment.
3. Set the Dockerfile path to `Dockerfile.paperlesspaper-api`.
4. Set the container port to `3000`.
5. Configure the health check path as `/health`.
6. Add the runtime environment variables from `.env.example` in Dokploy.
7. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY_BASE64` in Dokploy.
8. Set `REDIS_URL` if you want BullMQ cronjobs and the queue admin UI enabled.

Notes:

- The repository root Dockerfile is intended for Dokploy builds from a monorepo checkout.
- If your Dokploy version supports a custom build context, you can also use `packages/paperlesspaper-api/Dockerfile` with `packages/paperlesspaper-api` as the build context.
- If package installation needs npm registry auth during the image build, add the Dokploy build arg `NPMRC_BASE64`. `NPM_TOKEN` still works as a fallback for simple npmjs auth.
- The container installs Chromium and sets `CHROME_BIN=/usr/bin/chromium` for the rendering endpoints.
- If `REDIS_URL` is missing, BullMQ is disabled automatically and `/admin/queues` returns `503` instead of repeatedly trying `127.0.0.1:6379`.

### Firebase secrets

Use these Dokploy runtime secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY_BASE64`

Generate `FIREBASE_PRIVATE_KEY_BASE64` from a Firebase service account JSON file with:

```bash
node -e "const fs=require('fs'); const json=JSON.parse(fs.readFileSync('service-account.json','utf8')); process.stdout.write(Buffer.from(json.private_key,'utf8').toString('base64'))"
```

You can also use `FIREBASE_PRIVATE_KEY` instead of the base64 variant. If you do that, wrapping the full value in single or double quotes is acceptable as long as the deployment UI preserves the full string. Base64 is still safer because it avoids newline escaping issues.

### NPM registry auth

If the Docker build needs a private `.npmrc`, create a base64 value and pass it as the Dokploy build arg `NPMRC_BASE64`:

```bash
base64 -i .npmrc | tr -d '\n'
```
