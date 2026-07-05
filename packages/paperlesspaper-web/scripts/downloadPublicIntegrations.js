/**
 * Downloads published website integrations and writes an importable snapshot.
 *
 * The app uses this generated file as the instant, offline-friendly list in the
 * integration picker, then refreshes with live data at runtime.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_PUBLIC_BACKEND_URL = "https://backend.paperlesspaper.de/api";
const DEFAULT_WEBSITE_URL = "https://paperlesspaper.de";
const DEFAULT_APP_URL = "http://web.paperlesspaper.de";
const DEFAULT_INTEGRATION_CONFIG_BASE_URL =
  "https://integrations.paperlesspaper.de";
const DEFAULT_LOCALES = ["de", "en", "fr", "nl", "se", "cz", "et"];
const OUTPUT_PATH = "./src/generated/publicIntegrations.ts";

const parseArgs = (argv) => {
  const args = {};

  argv.forEach((arg) => {
    if (!arg.startsWith("--")) return;

    const [key, ...valueParts] = arg.slice(2).split("=");
    if (!key) return;

    const value = valueParts.join("=");
    args[key] = value === "" ? "true" : value;
  });

  return args;
};

const trimTrailingSlash = (value) => value.replace(/\/$/, "");

const getConfig = () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = trimTrailingSlash(
    args.baseUrl ||
      process.env.PUBLIC_INTEGRATIONS_BACKEND_URL ||
      process.env.REACT_APP_WEB_BACKEND_URL ||
      process.env.WEB_BACKEND_URL ||
      DEFAULT_PUBLIC_BACKEND_URL,
  );
  const websiteUrl = trimTrailingSlash(
    args.websiteUrl ||
      process.env.REACT_APP_SERVER_WEBSITE_URL ||
      DEFAULT_WEBSITE_URL,
  );
  const appUrl = trimTrailingSlash(
    args.appUrl || process.env.REACT_APP_AUTH_REDIRECT_URL || DEFAULT_APP_URL,
  );
  const integrationConfigBaseUrl = trimTrailingSlash(
    args.integrationConfigBaseUrl ||
      process.env.REACT_APP_INTEGRATIONS_CONFIG_BASE_URL ||
      DEFAULT_INTEGRATION_CONFIG_BASE_URL,
  );
  const locales = (
    args.locales ||
    process.env.PUBLIC_INTEGRATION_LOCALES ||
    DEFAULT_LOCALES.join(",")
  )
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);

  return {
    appUrl,
    baseUrl,
    integrationConfigBaseUrl,
    locales,
    outputPath: args.outputPath || process.env.OUTPUT_PATH || OUTPUT_PATH,
    strict: args.strict === "true" || process.env.PUBLIC_INTEGRATIONS_STRICT === "1",
    websiteUrl,
  };
};

const getConfigUrl = (doc, config) => {
  if (doc.configUrl) return doc.configUrl;
  if (!doc.slug?.startsWith("integrations/")) return undefined;

  const integrationSlug = doc.slug.replace(/^integrations\//, "");
  if (!integrationSlug) return undefined;

  return `${config.integrationConfigBaseUrl}/${integrationSlug}/config.json`;
};

const getPublicAssetUrl = (url, baseUrl) => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith("/")) return url;

  try {
    return `${new URL(baseUrl).origin}${url}`;
  } catch {
    return url;
  }
};

const mapIntegration = (doc, config) => {
  const configUrl = getConfigUrl(doc, config);
  if (!doc?.id || !configUrl) return null;

  const websiteUrl = `${config.websiteUrl}/${doc.slug || ""}`.replace(
    /\/$/,
    "",
  );

  return {
    id: String(doc.id),
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
      config.baseUrl,
    ),
    configUrl,
    githubUrl: doc.githubUrl,
    websiteUrl,
    installUrl: `${config.appUrl}/integration?url=${encodeURIComponent(configUrl)}`,
  };
};

const sortIntegrations = (integrations) =>
  [...integrations].sort((a, b) => {
    const popularityDifference = b.popularity - a.popularity;
    const dateDifference =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    return popularityDifference || dateDifference;
  });

const fetchLocale = async (locale, config) => {
  const search = new URLSearchParams({
    limit: "1000",
    locale,
    draft: "false",
  });
  const url = `${config.baseUrl}/integrations?${search.toString()}`;

  console.log(`Loading integrations for ${locale}: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${locale}: ${response.status}`);
  }

  const payload = await response.json();
  const docs = Array.isArray(payload) ? payload : payload?.docs || [];

  return sortIntegrations(
    docs.map((doc) => mapIntegration(doc, config)).filter(Boolean),
  );
};

const writeSnapshot = async (snapshot, config) => {
  const outputPath = path.resolve(config.outputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const content = `import type { AppIntegration } from "helpers/publicIntegrations";

export const generatedPublicIntegrations = ${JSON.stringify(
    snapshot,
    null,
    2,
  )} satisfies Record<string, AppIntegration[]>;

export const generatedPublicIntegrationsAt = ${JSON.stringify(
    new Date().toISOString(),
  )};
`;

  await fs.writeFile(outputPath, content);
  console.log(`Saved ${config.outputPath}`);
};

const readExistingSnapshot = async (config) => {
  try {
    await fs.access(path.resolve(config.outputPath));
    return true;
  } catch {
    return false;
  }
};

const run = async () => {
  const config = getConfig();
  const snapshot = {};
  const failures = [];

  for (const locale of config.locales) {
    try {
      snapshot[locale] = await fetchLocale(locale, config);
      console.log(`Saved ${snapshot[locale].length} integrations for ${locale}`);
    } catch (error) {
      failures.push(error);
      console.warn(error?.message || error);
    }
  }

  if (Object.keys(snapshot).length > 0) {
    await writeSnapshot(snapshot, config);
    return;
  }

  if (config.strict || !(await readExistingSnapshot(config))) {
    throw failures[0] || new Error("Failed to download integrations");
  }

  console.warn("Keeping existing public integrations snapshot.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
