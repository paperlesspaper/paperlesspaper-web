# Mobile photo-import regression harness

Run from the repository root:

```sh
yarn --cwd packages/paperlesspaper-web vite --config tests/mobile-import/vite.config.mjs
```

Open `http://127.0.0.1:3217` in an iOS Simulator's Safari or `http://10.0.2.2:3217` in an Android emulator's Chrome. The page runs automatically, displays PASS/FAIL, and posts the final JSON to the Vite console (`MOBILE_IMPORT_RESULT`). Reload to repeat. Use only on a trusted local network; the development server binds to all interfaces for device testing.

The harness imports the production `MultiImageUploadEditor`, `ImageEditor`, `Editor`, image preparation, Fabric, image filters and export/dithering code. It replaces routing, account/device hooks, surrounding modal UI, form initialization and API mutations with local fixtures. No account or production API is used. Selection uses `DataTransfer` and the real file input's change event, so this does **not** test the OS photo picker, Capacitor bridge, cloud-photo downloads, HEIC compatibility, backend persistence or physical-device memory limits.

Cases:

- 12, 13 and 30 different JPEG photos at 4032 × 3024 pixels.
- At most one active editor (four DOM canvases), with no editor mounted while idle.
- A rotation survives closing/reopening the editor and export.
- The seventh upload in the 13-photo batch fails once. Later files finish; retry uploads only that photo and reuses its paper ID.
- A corrupt JPEG among the 30-photo selection is named as a preparation error; every valid photo still exports and uploads.
- All exported files are nonempty, editable canvases contain an image, and papers are created in selection order with their filenames.

The importer retains per-file results in selection order across retries. The library's existing `updatedAt` sort is unchanged: retrying a paper can move it in that view. Filenames now identify the imported papers. A failed create request whose response is lost cannot be deduplicated across reloads without server-side idempotency; the retained IDs cover known successful creates within the open import.

## Verification on 2026-11-09

Passed on the current local development checkout (`049ec47`) with the fix:

| Runtime | 12 | 13 + upload retry | 30 + corrupt JPEG | Peak DOM canvases |
| --- | --- | --- | --- | --- |
| iOS 27.0 Simulator, iPhone 17 Pro, Safari 27 | PASS | PASS | PASS | 4 |
| Android 14 emulator, Pixel 7 / API 34, Chrome 113 | PASS | PASS | PASS | 4 |
| Desktop Chromium 156 | PASS | PASS | PASS | 4 |

Physical devices were unavailable. The user approved simulator/emulator validation. Native picker and complete authenticated-app checks remain manual acceptance checks before closing #172/#195.
