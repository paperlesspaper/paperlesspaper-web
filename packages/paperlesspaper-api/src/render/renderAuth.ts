import { parseRenderUrl } from "./renderNetwork";

/** Keep credentials out of browser URLs, redirects and render diagnostics. */
export function parseAuthenticatedRenderUrl(value: string) {
  try {
    const url = new URL(value);
    const authenticated = Boolean(url.username || url.password);
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    url.username = "";
    url.password = "";
    parseRenderUrl(url.href);
    return {
      url: url.href,
      auth: authenticated
        ? {
            origin: url.origin,
            authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString("base64")}`,
          }
        : undefined,
    };
  } catch {
    // URL/decoding errors must not echo a URL containing credentials.
    throw new Error("Invalid render URL");
  }
}

export function renderAuthHeaders(
  url: string,
  headers: Record<string, string>,
  auth: NonNullable<ReturnType<typeof parseAuthenticatedRenderUrl>["auth"]>
): Record<string, string> {
  // Re-evaluate every request, including each redirect hop and subresource.
  // Never use page.authenticate/setExtraHTTPHeaders: those are not origin-scoped.
  const target = new URL(url);
  const sameOrigin =
    ["http:", "https:"].includes(target.protocol) &&
    target.origin === auth.origin;
  const result = { ...headers };
  for (const key of Object.keys(result)) {
    if (
      key.toLowerCase() === "authorization" &&
      (sameOrigin || result[key] === auth.authorization)
    )
      delete result[key];
  }
  if (sameOrigin) {
    result.authorization = auth.authorization;
  }
  return result;
}
