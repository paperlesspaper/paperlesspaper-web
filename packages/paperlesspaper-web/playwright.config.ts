import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3200";
const dirname = path.dirname(fileURLToPath(import.meta.url));
const useLocalApi = process.env.PLAYWRIGHT_USE_LOCAL_API === "1";
const localApiPort = process.env.PLAYWRIGHT_API_PORT ?? "5002";
const viteMode = process.env.PLAYWRIGHT_VITE_MODE;
const videoMode =
  process.env.PLAYWRIGHT_VIDEO === "1" ? "on" : "retain-on-failure";
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(dirname, "package.json"), "utf8"),
) as { version: string };
const productionEnvPath = path.resolve(dirname, ".env.production");
const testEnvPath = path.resolve(dirname, ".env.test");
const localEnvPath = path.resolve(dirname, ".env.playwright.local");

function loadEnvFile(filePath: string, overwrite = false) {
  if (!fs.existsSync(filePath)) return;

  const envFile = fs.readFileSync(filePath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);

    if (!match || line.trim().startsWith("#")) continue;

    const [, key, rawValue = ""] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");

    if (overwrite) {
      process.env[key] = value;
    } else {
      process.env[key] ??= value;
    }
  }
}

loadEnvFile(productionEnvPath);
loadEnvFile(testEnvPath);
loadEnvFile(localEnvPath, true);

if (useLocalApi) {
  process.env.REACT_APP_SERVER_BASE_URL ??= `http://localhost:${localApiPort}/v1/`;
}

process.env.AUTH0_DOMAIN ??= process.env.REACT_APP_AUTH0_DOMAIN;
process.env.AUTH0_AUDIENCE ??= process.env.REACT_APP_AUTH0_AUDIENCE;

if (
  !process.env.REACT_APP_VERSION ||
  process.env.REACT_APP_VERSION === "$npm_package_version"
) {
  process.env.REACT_APP_VERSION = packageJson.version;
}

console.log(
  `[playwright.config] baseURL=${baseURL} vite_mode=${viteMode ?? "(default)"} auth0_domain=${process.env.REACT_APP_AUTH0_DOMAIN ?? "(unset)"} auth0_client_id=${process.env.REACT_APP_AUTH0_CLIENT_ID ?? "(unset)"}`,
);

const frontendServer = {
  command:
    `SASS_SILENCE_DEPRECATIONS=all VITE_CJS_TRACE=true yarn -s vite dev --host localhost${viteMode ? ` --mode ${viteMode}` : ""}`,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const localApiServer = {
  command:
    "cd ../paperlesspaper-api && ../../node_modules/.bin/env-cmd -f ${PLAYWRIGHT_API_ENV_FILE:-.env.production} sh -lc 'NODE_OPTIONS=--preserve-symlinks NODE_ENV=test PORT=${PLAYWRIGHT_API_PORT:-5002} MONGODB_URL=${PLAYWRIGHT_MONGODB_URL:-mongodb://127.0.0.1:27017/paperlesspaper-e2e} CORS_WHITELIST=http://localhost:3200,http://127.0.0.1:3200 DISABLE_BULLMQ=true PAPERLESSPAPER_APPS_URL=${PAPERLESSPAPER_APPS_URL:-} node --loader ts-node/esm --experimental-specifier-resolution=node src/index.ts'",
  url: `http://localhost:${localApiPort}/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: videoMode,
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium",
      testIgnore: [/.*\.setup\.ts/, /public\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: useLocalApi ? [localApiServer, frontendServer] : frontendServer,
});
