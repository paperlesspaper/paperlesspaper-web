import type { OpenIntegrationManifest } from "./types";

export const CONFIG_URL_PATH = "meta.pluginConfigUrl";
export const MANIFEST_PATH = "meta.pluginManifest";
export const SETTINGS_PATH = "meta.pluginSettings";
export const RENDER_PAGE_PATH = "meta.pluginRenderPage";
export const SETTINGS_PAGE_PATH = "meta.pluginSettingsPage";
export const NAME_PATH = "meta.pluginName";
export const ICON_PATH = "meta.pluginIcon";
export const VERSION_PATH = "meta.pluginVersion";

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function getOriginFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isValidManifest(data: any): data is OpenIntegrationManifest {
  if (!data || typeof data !== "object") return false;
  if (typeof data.name !== "string" || !data.name.trim()) return false;
  if (typeof data.version !== "string" || !data.version.trim()) return false;

  if (
    data.requiredPermissions &&
    (!Array.isArray(data.requiredPermissions) ||
      data.requiredPermissions.some(
        (permission: unknown) => typeof permission !== "string",
      ))
  ) {
    return false;
  }

  if (data.settingsPage && typeof data.settingsPage !== "string") return false;
  if (data.renderPage && typeof data.renderPage !== "string") return false;
  if ("timezone" in data && !isValidTimeZone(data.timezone)) return false;
  return true;
}

export function hasRequiredPermission(
  manifest: OpenIntegrationManifest | undefined | null,
  permission: string,
) {
  return (
    Array.isArray(manifest?.requiredPermissions) &&
    manifest.requiredPermissions.includes(permission)
  );
}

export function isTrustedIntegrationConfigUrl(configUrl?: string | null) {
  if (!configUrl) return false;

  try {
    const { hostname } = new URL(configUrl);
    return (
      hostname === "paperlesspaper.de" || hostname.endsWith(".paperlesspaper.de")
    );
  } catch {
    return false;
  }
}

export function validateIntegrationConfigUrl(configUrl: string) {
  const trimmed = configUrl.trim();
  if (!trimmed) throw new Error("Missing config URL");
  if (trimmed.length > 2000) throw new Error("Config URL is too long");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid config URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Config URL must use HTTP or HTTPS");
  }

  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  if (parsed.protocol === "http:" && !isLocalhost) {
    throw new Error("Config URL must use HTTPS");
  }

  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

export async function fetchManifest(
  configUrl: string,
  signal?: AbortSignal,
): Promise<OpenIntegrationManifest> {
  const safeConfigUrl = validateIntegrationConfigUrl(configUrl);

  const response = await fetch(safeConfigUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }

  const data = await response.json();
  if (!isValidManifest(data)) {
    throw new Error("Invalid manifest format");
  }

  return data;
}

export function applyManifestToForm(form: any, manifest: OpenIntegrationManifest) {
  form.setValue?.(MANIFEST_PATH, manifest);
  form.setValue?.(NAME_PATH, manifest.name);
  form.setValue?.(VERSION_PATH, manifest.version);
  if (manifest.icon) form.setValue?.(ICON_PATH, manifest.icon);
  if (manifest.renderPage)
    form.setValue?.(RENDER_PAGE_PATH, manifest.renderPage);
  if (manifest.settingsPage)
    form.setValue?.(SETTINGS_PAGE_PATH, manifest.settingsPage);

  const native = manifest.nativeSettings || {};
  for (const [key, value] of Object.entries(native)) {
    const path = `meta.${key}`;
    const current = form.getValues?.(path);
    if (typeof current === "undefined") form.setValue?.(path, value);
  }

  const currentSettings = form.getValues?.(SETTINGS_PATH);
  if (!currentSettings) form.setValue?.(SETTINGS_PATH, {});
}

export async function loadManifestIntoForm(
  form: any,
  configUrl: string,
  signal?: AbortSignal,
) {
  const manifest = await fetchManifest(configUrl, signal);
  applyManifestToForm(form, manifest);
  return manifest;
}
