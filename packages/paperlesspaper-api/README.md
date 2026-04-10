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
7. Set `FIREBASE_ADMINSDK_JSON` in Dokploy instead of mounting the JSON key file into the image.

Notes:

- The repository root Dockerfile is intended for Dokploy builds from a monorepo checkout.
- If your Dokploy version supports a custom build context, you can also use `packages/paperlesspaper-api/Dockerfile` with `packages/paperlesspaper-api` as the build context.
- If package installation needs npm registry auth during the image build, add the Dokploy build arg `NPM_TOKEN`.
- The container installs Chromium and sets `CHROME_BIN=/usr/bin/chromium` for the rendering endpoints.
