import type { OpenIntegrationManifest } from "./types";

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

  if (data.settingsPage && typeof data.settingsPage !== "string") return false;
  if (data.renderPage && typeof data.renderPage !== "string") return false;
  return true;
}

export async function fetchManifest(
  configUrl: string
): Promise<OpenIntegrationManifest> {
  const response = await fetch(configUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
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
