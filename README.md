# Paperlesspaper Monorepo

This repository contains the Paperlesspaper API backend and the web/PWA + mobile app.

# Structure

- [paperlesspaper-api](paperlesspaper-api) Node.js/Express API (TypeScript, Fly.io deployment)
- [paperlesspaper-web](paperlesspaper-web) Vite/React web app with Capacitor iOS/Android builds

# Requirements

- Node.js (API requires Node >= 24)
- Yarn

# Quick Start

## API

```
cd paperlesspaper-api
yarn install
yarn dev
```

## Web

```
cd paperlesspaper-web
yarn install
yarn dev
```

# Build and Test

## API

```
cd paperlesspaper-api
yarn build
yarn test
```

API integration test details: [paperlesspaper-api/tests/README.md](paperlesspaper-api/tests/README.md)

## Web

```
cd paperlesspaper-web
yarn build
yarn test
```

# Environment

Each app reads from its own `.env` files. Review the existing `.env*` files in each app directory and adjust values for your environment.
