function source(paper: any) {
  if (
    paper?.kind !== "plugin" ||
    !paper.meta?.pluginManifest?.capabilities?.contentPush
  )
    return undefined;
  try {
    const config = new URL(paper.meta.pluginConfigUrl);
    const render = new URL(
      paper.meta.pluginRenderPage || paper.meta.pluginManifest.renderPage,
      config
    );
    return {
      config: config.href,
      render: render.href,
    };
  } catch {
    return undefined;
  }
}

// RTK may still hold an earlier response when the saved provider changes on the
// same paper. Only pass a response explicitly bound to the current renderer.
export function contentMatchesPushIntegration(paper: any, response: any) {
  const expected = source(paper);
  return Boolean(
    expected &&
      response?.configUrl === expected.config &&
      response?.renderUrl === expected.render
  );
}
// Unsaved edits must never forward private content to another integration renderer.
export function samePushIntegration(
  edited: any,
  saved: any,
  previewUrl: string | null
) {
  const expected = source(saved);
  const actual = source(edited);
  if (
    !expected ||
    !actual ||
    expected.config !== actual.config ||
    expected.render !== actual.render ||
    !previewUrl
  )
    return false;
  try {
    // Check the actual iframe destination, including any legacy URL fallback.
    return new URL(previewUrl).href === expected.render;
  } catch {
    return false;
  }
}
