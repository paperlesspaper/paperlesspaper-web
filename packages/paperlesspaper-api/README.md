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
