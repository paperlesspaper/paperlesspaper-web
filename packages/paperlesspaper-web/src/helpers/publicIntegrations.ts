import React from "react";
import { generatedPublicIntegrations } from "generated/publicIntegrations";

const DEFAULT_PUBLIC_BACKEND_URL = "https://backend.paperlesspaper.de/api";
const DEFAULT_WEBSITE_URL = "https://paperlesspaper.de";
const DEFAULT_APP_URL = "http://web.paperlesspaper.de";
const DEFAULT_INTEGRATION_CONFIG_BASE_URL =
  "https://integrations.paperlesspaper.de";

type PublicIntegrationDocument = {
  id?: string;
  title?: string;
  longTitle?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  createdAt?: string;
  popularity?: number | string;
  status?: string;
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

const normalizeLocale = (locale?: string) => (locale || "de").split("-")[0];

const getPublicBackendUrl = () =>
  trimTrailingSlash(
    import.meta.env.REACT_APP_WEB_BACKEND_URL || DEFAULT_PUBLIC_BACKEND_URL,
  );

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

export function getPublicIntegrationsUrl(locale?: string) {
  const search = new URLSearchParams({
    limit: "1000",
    locale: normalizeLocale(locale),
    draft: "false",
  });

  return `${getPublicBackendUrl()}/integrations?${search.toString()}`;
}

export function mapIntegration(
  doc: PublicIntegrationDocument,
): AppIntegration | null {
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
    iconUrl: getPublicAssetUrl(
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

export function getStaticPublicIntegrations(locale?: string) {
  const normalizedLocale = normalizeLocale(locale);

  return (
    generatedPublicIntegrations[normalizedLocale] ||
    generatedPublicIntegrations.de ||
    generatedPublicIntegrations.en ||
    []
  );
}

export async function fetchPublicIntegrations(
  locale?: string,
  signal?: AbortSignal,
) {
  const response = await fetch(getPublicIntegrationsUrl(locale), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load integrations: ${response.status}`);
  }

  const payload = await response.json();
  const docs = Array.isArray(payload) ? payload : payload?.docs || [];

  return sortIntegrations(docs.map(mapIntegration).filter(Boolean));
}

export function usePublicIntegrations(locale?: string) {
  const staticIntegrations = React.useMemo(
    () => getStaticPublicIntegrations(locale),
    [locale],
  );
  const [data, setData] =
    React.useState<AppIntegration[]>(staticIntegrations);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    setData(staticIntegrations);
    setIsLoading(true);
    setError(null);

    fetchPublicIntegrations(locale, controller.signal)
      .then((integrations) => {
        setData(integrations);
      })
      .catch((nextError) => {
        if (nextError?.name === "AbortError") return;
        setError(nextError);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [locale, staticIntegrations]);

  return { data, isLoading, error };
}
