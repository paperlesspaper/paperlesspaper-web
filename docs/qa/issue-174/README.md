# Multi-image editor — issue #174

Before: `develop` at `587a49d`. After: this PR. Screenshots captured at 1440 × 1000 in Chromium; the mobile capture uses 390 × 844.

The browser check mounts the real multi-upload, image editor, Fabric canvas, toolbar, modal and preview components with local fixture form/API hooks and synthetic images. No production data or frame hardware is involved. It does not exercise authentication or the live upload service.

| Scenario | Before | After |
| --- | --- | --- |
| Open a portrait photo | [Tiny canvas](before-editor.png) | [Canvas fills the available height](after-editor.png) |
| Click Rotate | [Image tools disappear](before-rotate.png) | [Image tools remain and the crop fills the landscape frame](after-rotate.png) |
| Continue back to the list | [Original photo, ignoring the edit](before-list.png) | [Saved landscape crop](after-list.png) |

[Mobile editor](after-mobile.png) · [E-paper preview without a stray Done button](after-preview.png)

The list uses a full-color thumbnail, while the e-paper preview applies the device palette. Both use the same crop and orientation.

## Validation

- Web unit suite: 42 files, 362 tests passed.
- Final focused rerun: 5 files, 34 tests passed.
- TypeScript: `tsc --noEmit --pretty false` passed.
- New geometry/selection tests and export helper pass ESLint 9. The shared local install's ESLint 8 cannot load the repository's newer TypeScript ESLint rules; ESLint 9 was invoked separately without changing dependencies.
- Chromium: open, rotate, preview/back, close/reopen, mobile resize, and ten consecutive orientation changes. After reopening and rotating ten times, the normalized list thumbnail and editor canvas differ by only 0.038 per 8-bit RGBA channel on average (resampling).
- Firefox 158: landscape image import, eleven orientation changes, and close/reopen preserve the final portrait crop and keep photo tools visible. [Screenshot](after-firefox.png).
- Unit regressions cover photo selection during rotation, retained frame coverage, reversible orientation changes at 0°, 33°, and 90°, viewport-independent thumbnails, and restoring edited state for upload.

## Manual reproduction

1. Open Multi Image Upload and select a portrait and a landscape image.
2. Edit either image: check its initial orientation, the usable canvas size, and frame coverage.
3. Click Rotate repeatedly. Size and adjustment tools must remain available, with no accumulating white borders.
4. Open Preview, then Back. Done must not cover the preview, and the selected photo's tools must remain available on return.
5. Continue to the list. The thumbnail must show the saved crop and orientation.
6. Reopen the image and resize the window, including a narrow mobile viewport. The crop must remain unchanged.
7. Upload both images and check their saved orientation and full-color originals.
