# Paperlesspaper Monorepo

> ⚠️ Work in progress: this package and its documentation are currently being updated.

This repository is a Yarn + Lerna monorepo for Paperlesspaper applications and shared code.

## Monorepo structure

Top-level layout:

- `packages/paperlesspaper-api`: backend API (Node.js, Express, TypeScript)
- `packages/paperlesspaper-web`: frontend app (Vite, React, Capacitor)
- `packages/helpers`: shared helper package used by other packages

Inside the packages:

- `packages/paperlesspaper-api/src`: API source code
- `packages/paperlesspaper-api/tests`: API tests
- `packages/paperlesspaper-web/src`: web app source code
- `packages/paperlesspaper-web/android` + `packages/paperlesspaper-web/ios`: mobile app projects generated/managed via Capacitor

## Requirements

- Node.js (API requires `>=24`)
- Yarn (Classic)

## Install

From repository root:

```bash
yarn install
```

## Development

Run each package from its own folder.

### API

```bash
cd packages/paperlesspaper-api
yarn dev
```

Default local API port in scripts is `5002`.

### Web

```bash
cd packages/paperlesspaper-web
yarn dev
```

The web app runs with Vite and reads package-specific `.env*` files.

## Build and test

### Build all packages

From repository root:

```bash
yarn build
```

### API

```bash
cd packages/paperlesspaper-api
yarn test
```

Useful API scripts:

- `yarn test:watch`
- `yarn test:smoke`
- `yarn coverage`
- `yarn lint`

Integration test details: [packages/paperlesspaper-api/tests/README.md](packages/paperlesspaper-api/tests/README.md)

### Web

```bash
cd packages/paperlesspaper-web
yarn build
yarn test
```

Useful web scripts:

- `yarn dev:prod` (run with production env values)
- `yarn build:production`
- `yarn build:app` (build + Capacitor sync)
- `yarn run:ios` / `yarn run:android`

## Environment variables

Each package uses its own `.env*` files. Configure environment values directly inside the package you are running.

Typical files:

- `packages/paperlesspaper-api/.env*`
- `packages/paperlesspaper-web/.env*`

## Release and deployment

- API deployment scripts and config are in `packages/paperlesspaper-api` (for example `fly.toml` and `scripts/`).
- Web deployment and mobile release scripts are in `packages/paperlesspaper-web/package.json`.
- Lerna versioning/publishing commands are available at repository root.

## GitHub Actions release flows

This repository includes production release workflows in `.github/workflows`:

- `release-version.yml`: manual Lerna versioning and tag creation.
- `deploy-paperlesspaper-api.yml`: deploy API to Fly.io.
- `deploy-paperlesspaper-web.yml`: deploy web app to Vercel.

### Trigger model

- Deploy workflows support both `push` on `main` (with path filters) and manual `workflow_dispatch`.
- Versioning is manual (`workflow_dispatch`) so release tags are explicit.

### Lerna versioning

- Run the **Release Version (Lerna)** workflow to create version commits and tags from conventional commits.
- The workflow runs `yarn lerna:versionNoPush`, then pushes the generated commit and tags.
- The workflow also publishes `@paperlesspaper/helpers` to npm when the current helpers version is not yet published.

### Required GitHub secrets

- Fly.io API deploy:
- `FLY_API_TOKEN`

- Vercel web deploy:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

- npm registry auth used during `yarn install` in workflows:
- `NPMRC_CONTENT` (full `.npmrc` content)

### `.npmrc` auth strategy

- CI writes `.npmrc` from `NPMRC_CONTENT` at runtime before dependency installation.
- Keep the full npm auth configuration in the GitHub secret, not in repository files.

### Dependency policy in CI

- CI/CD workflows deploy the repository state as committed.
- Workflows do not rewrite dependencies and do not modify `package.json` files.
- API deployment uses the npm-published `@paperlesspaper/helpers` version. If missing, the API workflow publishes the current helpers version before Fly deploy.

## Where to continue reading

- API package docs: [packages/paperlesspaper-api](packages/paperlesspaper-api)
- Web package docs: [packages/paperlesspaper-web/README.md](packages/paperlesspaper-web/README.md)
- Root workspace config: [package.json](package.json), [lerna.json](lerna.json)

## Notes

- Lerna is used to orchestrate workspace-level builds and releases.
- Some root-level scripts currently reference legacy paths; package-level scripts are the reliable default for day-to-day development.
