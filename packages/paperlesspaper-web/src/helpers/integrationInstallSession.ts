import type { OpenIntegrationManifest } from "components/Epaper/Integrations/OpenIntegrationEditor/types";

const STORAGE_PREFIX = "paperlesspaper.integrationInstall.";
const SESSION_TTL_MS = 10 * 60 * 1000;

export type IntegrationInstallSession = {
  configUrl: string;
  manifest?: OpenIntegrationManifest;
  createdAt: number;
};

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function createIntegrationInstallSession(
  configUrl: string,
  manifest?: OpenIntegrationManifest,
) {
  const storage = getStorage();
  const id = createSessionId();

  storage?.setItem(
    `${STORAGE_PREFIX}${id}`,
    JSON.stringify({
      configUrl,
      manifest,
      createdAt: Date.now(),
    }),
  );

  return id;
}

export function consumeIntegrationInstallSession(
  id?: string | null,
): IntegrationInstallSession | null {
  if (!id) return null;

  const storage = getStorage();
  const key = `${STORAGE_PREFIX}${id}`;
  const raw = storage?.getItem(key);
  storage?.removeItem(key);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as IntegrationInstallSession;
    if (!parsed?.configUrl || !parsed.createdAt) return null;
    if (Date.now() - parsed.createdAt > SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
