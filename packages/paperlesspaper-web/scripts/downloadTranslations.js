/**
 * downloadTranslations.js
 *
 * Downloads translation entries from the backend and writes one JSON file per locale.
 *
 * Usage:
 * - yarn downloadTranslation --namespace=pwa --locales=en,de --exportPath=./tmp/translations --baseUrl=http://localhost:8080
 * - yarn downloadTranslation:plp-pwa
 *
 * Configuration (CLI flag > environment variable > default):
 * - --namespace / NAMESPACE (required)
 * - --locales / LOCALES (comma separated, default: en)
 * - --exportPath / EXPORT_PATH (default: ./translations)
 * - --baseUrl / TRANSLATIONS_BASE_URL / WEB_BACKEND_URL (default: http://localhost:8080)
 */
import axios from "axios";
import * as fs from "fs";

const parseArgs = (argv) => {
  const args = {};

  argv.forEach((arg) => {
    if (!arg.startsWith("--")) {
      return;
    }

    const [key, ...valueParts] = arg.slice(2).split("=");
    const value = valueParts.join("=");
    if (!key) {
      return;
    }

    args[key] = value === "" ? "true" : value;
  });

  return args;
};

const getConfig = () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl =
    args.baseUrl ||
    process.env.TRANSLATIONS_BASE_URL ||
    process.env.WEB_BACKEND_URL ||
    "http://localhost:8080";

  const namespace = args.namespace || process.env.NAMESPACE;
  const exportPath =
    args.exportPath || process.env.EXPORT_PATH || "./translations";
  const localesSource = args.locales || process.env.LOCALES;
  const locales = localesSource
    ? localesSource
        .split(",")
        .map((locale) => locale.trim())
        .filter(Boolean)
    : ["en"];

  if (!namespace) {
    throw new Error(
      "Missing namespace. Provide --namespace=<value> or set NAMESPACE.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    namespace,
    exportPath,
    locales,
  };
};

const loadResources = async (language, namespace, baseUrl) => {
  const url = `${baseUrl}/api/translations?limit=1000&where[namespace][equals]=${namespace}&locale=${language}`;

  console.log("loadPath", url);

  const response = await axios({
    method: "get",
    url,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const results = {};

  if (response.data.docs) {
    response.data.docs.forEach((element) => {
      if (element.translation) {
        results[element.key] = element.translation[0].content;
      }
    });
  }
  return results; // { [language]: { posts: { results } } };
};

export async function downloadTranslations(config = getConfig()) {
  if (!fs.existsSync(config.exportPath)) {
    fs.mkdirSync(config.exportPath, { recursive: true });
  }

  for (const locale of config.locales) {
    const resources = await loadResources(
      locale,
      config.namespace,
      config.baseUrl,
    );

    fs.writeFileSync(
      `${config.exportPath}/${locale}.json`,
      JSON.stringify(resources, null, 4),
    );

    console.log(`Saved ${locale}.json`);
  }
}

const run = async () => {
  const config = getConfig();
  await downloadTranslations(config);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
