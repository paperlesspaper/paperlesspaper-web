> ⚠️ Work in progress: this package and its documentation are currently being updated.

# @paperlesspaper/web

Web app and mobile app (iOS/Android via Capacitor) for Paperlesspaper.

## Development

- `yarn start`: Start local development server using `.env`.
- `yarn dev`: Start local development server without `env-cmd`.
- `yarn dev:prod`: Run dev server with production environment values.

## Build

- `yarn build`: TypeScript compile + Vite build.
- `yarn build:local`: Build using `.env`.
- `yarn build:production`: Build using `.env.production`.
- `yarn preview`: Preview the production build locally.

## Type checks & tests

- `yarn ts`: Run TypeScript checks (`--noEmit`).
- `yarn ts:watch`: Run TypeScript checks in watch mode.
- `yarn test`: Run test suite.

## Mobile (Capacitor)

- `yarn build:app`: Production web build + `cap sync`.
- `yarn run:ios`: Build and run iOS app.
- `yarn run:android`: Build and run Android app.
- `yarn resources`: Regenerate app icons/splash assets.

## Deploy

- `yarn deploy`: Deploy web app to Vercel.
- `yarn deploy:app`: Run app deployment pipeline.
- `yarn deploy:testflight` / `yarn deploy:appstore`: iOS deployment.
- `yarn deploy:googleplay` / `yarn deploy:playstore`: Android deployment.

## Notes

- Main brand scripts use `.env` / `.env.production`.
- Additional `wirewire:*` scripts exist for the Wirewire variant.
