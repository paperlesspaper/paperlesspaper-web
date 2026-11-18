# EPD Optimize rendering

The API, web editor and isolated renderer use `epdoptimize` 1.4.1.

## Websites

Website papers (`kind: "website"`) enable `protectTextAndGraphics` by default,
including existing papers without a saved preference. The website editor's
**Text and graphics** settings can turn it off or explicitly enable it.
The setting is stored as the boolean `meta.protectTextAndGraphics`.

This experimental detector quantizes flat text/graphics directly to the selected
palette while photographs and gradients continue through dithering. It works on
the screenshot at the target display resolution, after image adjustments.
The website's iframe preview is unchanged; processing happens when rendering for
the frame. Inspect the display result, particularly for low-contrast text or text
over photos. Detected protected regions use JavaScript error diffusion even if
the automatic/WASM engine was selected, so processing can take longer.

Settings precedence is: a saved website preference, an explicit page meta-tag
option, then the website default (`true`). A page's `enabled: false` still skips
the entire optimization stage. Other integration kinds retain their defaults.

## Integration metadata and layouts

Integrations can enable or disable protection through the existing meta tag:

```html
<meta name="paperless:epd-optimize"
      content='{"intent":"readable","options":{"protectTextAndGraphics":true}}'>
```

`false` disables protection. The library's advanced object form is also supported:

```html
<meta name="paperless:epd-optimize"
      content='{"options":{"protectTextAndGraphics":{"enabled":true,"colorTolerance":10,"edgeContrast":36,"minRegionPixels":12,"regionGrouping":true}}}'>
```

The option is accepted at the top level and within the existing options aliases,
including `canvasDitherOptions`. Layout region `processing` metadata accepts the
same syntax, allowing a text-heavy integration to opt in without changing other
regions. Already processed regions (`enabled: false`) retain their device colors.

## 1.4.1 correction

Native error diffusion now projects source colors onto reachable palette mixtures
before diffusing errors. This reduces colored speckles and damaged strokes in
hard black-and-white graphics, including when text protection is disabled. It also
changes photographic output. The correction applies to palettes with up to eight
distinct colors and longer collinear grayscale palettes; other dithering algorithms
are unchanged. Website text/graphics protection remains enabled by default.

## Other 1.4.0 improvements

- Corrected signed, fractional error diffusion benefits the existing photo/editor
  pipeline as well, especially cyan and mixed colors. Pixel output can change.
- Blue Noise has a new high-resolution mask and coverage-based color mixtures.
  It remains an explicit algorithm choice; Node loads its PNG from the installed
  package. Keep `epdoptimize/dist/assets` with the package when deploying.
- New three-/four-color and 16-gray palettes may benefit future hardware support.
  Existing frame palettes are unchanged; adding a palette alone does not establish
  firmware compatibility.

Deploy the isolated renderer together with the API and web update: the renderer
parses metadata and applies website defaults before sending settings to the API.

Upstream: [1.4.1 release](https://github.com/paperlesspaper/epdoptimize/releases/tag/v1.4.1),
[1.4.0 release](https://github.com/paperlesspaper/epdoptimize/releases/tag/v1.4.0)
and [processing documentation](https://github.com/paperlesspaper/epdoptimize/blob/v1.4.1/README.md).
