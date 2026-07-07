const DEFAULT_PUBLIC_BACKEND_URL = "https://backend.paperlesspaper.de/api";
const DEFAULT_WEBSITE_URL = "https://paperlesspaper.de";
const DEFAULT_APP_URL = "https://web.paperlesspaper.de";
const DEFAULT_INTEGRATION_CONFIG_BASE_URL =
  "https://integrations.paperlesspaper.de";
const PREVIEW_ICON_TRANSFORM = "c_limit,w_128,h_128,f_auto,q_auto";
const PUBLIC_INTEGRATIONS_CACHE_KEY_PREFIX =
  "paperlesspaper.publicIntegrations";

export type PublicIntegrationDocument = {
  id?: string;
  title?: string;
  longTitle?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  createdAt?: string;
  popularity?: number | string;
  status?: string;
  internal?: boolean;
  configUrl?: string;
  githubUrl?: string;
  config?: {
    name?: string;
    version?: string;
    description?: string;
  };
  hero?: {
    media?: {
      thumbnailURL?: string;
      url?: string;
    };
  };
};

export type AppIntegration = {
  id: string;
  title: string;
  longTitle?: string;
  subtitle?: string;
  excerpt?: string;
  configName?: string;
  configDescription?: string;
  description: string;
  version?: string;
  status?: string;
  popularity: number;
  createdAt: string;
  iconUrl?: string;
  configUrl: string;
  githubUrl?: string;
  websiteUrl: string;
  installUrl: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const normalizePublicIntegrationsLocale = (locale?: string) =>
  (locale || "de").split("-")[0];

const getPublicBackendUrl = () =>
  trimTrailingSlash(DEFAULT_PUBLIC_BACKEND_URL);

const getWebsiteUrl = () =>
  trimTrailingSlash(
    import.meta.env.REACT_APP_SERVER_WEBSITE_URL || DEFAULT_WEBSITE_URL,
  );

const getAppUrl = () =>
  trimTrailingSlash(
    import.meta.env.REACT_APP_AUTH_REDIRECT_URL ||
      (typeof window !== "undefined" ? window.location.origin : "") ||
      DEFAULT_APP_URL,
  );

const getIntegrationConfigBaseUrl = () =>
  trimTrailingSlash(
    import.meta.env.REACT_APP_INTEGRATIONS_CONFIG_BASE_URL ||
      DEFAULT_INTEGRATION_CONFIG_BASE_URL,
  );

const getConfigUrl = (doc: PublicIntegrationDocument) => {
  if (doc.configUrl) return doc.configUrl;
  if (!doc.slug?.startsWith("integrations/")) return undefined;

  const integrationSlug = doc.slug.replace(/^integrations\//, "");
  if (!integrationSlug) return undefined;

  return `${getIntegrationConfigBaseUrl()}/${integrationSlug}/config.json`;
};

const getPublicAssetUrl = (url?: string) => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith("/")) return url;

  try {
    return `${new URL(getPublicBackendUrl()).origin}${url}`;
  } catch {
    return url;
  }
};

const getPreviewIconUrl = (url?: string) => {
  const publicUrl = getPublicAssetUrl(url);
  if (!publicUrl) return undefined;

  try {
    const parsedUrl = new URL(publicUrl);
    if (parsedUrl.hostname !== "media.paperlesspaper.de") return publicUrl;

    parsedUrl.pathname = parsedUrl.pathname.replace(
      /^\/t\/[^/]+\//,
      `/t/${PREVIEW_ICON_TRANSFORM}/`,
    );

    return parsedUrl.toString();
  } catch {
    return publicUrl;
  }
};

export function getPublicIntegrationsUrl(locale?: string) {
  const search = new URLSearchParams({
    limit: "1000",
    locale: normalizePublicIntegrationsLocale(locale),
    draft: "false",
  });

  return `${getPublicBackendUrl()}/integrations?${search.toString()}`;
}

export function mapIntegration(
  doc: PublicIntegrationDocument,
): AppIntegration | null {
  if (doc?.internal) return null;

  const configUrl = getConfigUrl(doc);
  if (!doc?.id || !configUrl) return null;

  const websiteUrl = `${getWebsiteUrl()}/${doc.slug || ""}`.replace(/\/$/, "");

  return {
    id: doc.id,
    title: doc.title || doc.config?.name || doc.longTitle || "",
    longTitle: doc.longTitle,
    subtitle: doc.subtitle,
    excerpt: doc.excerpt,
    configName: doc.config?.name,
    configDescription: doc.config?.description,
    description: doc.excerpt || doc.subtitle || doc.config?.description || "",
    version: doc.config?.version,
    status: doc.status,
    popularity: Number(doc.popularity || 0),
    createdAt: doc.createdAt || "",
    iconUrl: getPreviewIconUrl(
      doc.hero?.media?.thumbnailURL || doc.hero?.media?.url,
    ),
    configUrl,
    githubUrl: doc.githubUrl,
    websiteUrl,
    installUrl: `${getAppUrl()}/integration?url=${encodeURIComponent(
      configUrl,
    )}`,
  };
}

export function sortIntegrations(
  integrations: AppIntegration[],
  sortBy: "popularity" | "dateAdded" = "popularity",
) {
  return [...integrations].sort((a, b) => {
    const popularityDifference = b.popularity - a.popularity;
    const dateDifference =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    if (sortBy === "dateAdded") {
      return dateDifference || popularityDifference;
    }

    return popularityDifference || dateDifference;
  });
}

const isAppIntegration = (value: unknown): value is AppIntegration => {
  if (!value || typeof value !== "object") return false;

  const integration = value as Partial<AppIntegration>;

  return (
    typeof integration.id === "string" &&
    typeof integration.title === "string" &&
    typeof integration.description === "string" &&
    typeof integration.configUrl === "string"
  );
};

const getPublicIntegrationsCacheKey = (locale?: string) =>
  `${PUBLIC_INTEGRATIONS_CACHE_KEY_PREFIX}:${normalizePublicIntegrationsLocale(
    locale,
  )}`;

export function getCachedPublicIntegrations(locale?: string) {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(
      getPublicIntegrationsCacheKey(locale),
    );

    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    const integrations = Array.isArray(parsedValue)
      ? parsedValue
      : parsedValue?.integrations;

    return Array.isArray(integrations)
      ? integrations.filter(isAppIntegration)
      : [];
  } catch {
    return [];
  }
}

export const cachePublicIntegrations = (
  locale: string | undefined,
  integrations: AppIntegration[],
) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getPublicIntegrationsCacheKey(locale),
      JSON.stringify({
        cachedAt: new Date().toISOString(),
        integrations,
      }),
    );
  } catch {
    // Ignore storage errors; the live backend response remains the source of truth.
  }
};
