#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const cliArgs = process.argv.slice(2);

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Trim inline comments in unquoted values: KEY=value # comment
  const commentIndex = trimmed.indexOf(" #");
  if (commentIndex >= 0) {
    return trimmed.slice(0, commentIndex).trim();
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = parseEnvValue(rawValue);
  }
}

function resolveEnvFilePathFromArgs(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--env-file" && args[i + 1]) {
      return path.resolve(process.cwd(), args[i + 1]);
    }
    if (args[i].startsWith("--env-file=")) {
      return path.resolve(process.cwd(), args[i].slice("--env-file=".length));
    }
  }
  return null;
}

const explicitEnvFile = resolveEnvFilePathFromArgs(cliArgs);
if (explicitEnvFile) {
  loadEnvFile(explicitEnvFile);
} else {
  // Common repo locations for local secrets used by this script.
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), "packages/paperlesspaper-web/.env"));
}

const SOURCE_REGISTRY = process.env.SOURCE_REGISTRY || "https://npm.fontawesome.com/";
const TARGET_REGISTRY =
  process.env.TARGET_REGISTRY ||
  "https://pkgs.dev.azure.com/wirewire/memo/_packaging/wirewirememo/npm/registry/";
const LOCAL_NODE_MODULES_DIR =
  process.env.LOCAL_NODE_MODULES_DIR || "node_modules/@fortawesome";

const FONTAWESOME_TOKEN = process.env.FONTAWESOME_TOKEN;
const AZURE_USERNAME = process.env.AZURE_USERNAME || "wirewire";
const AZURE_PASSWORD_B64 = process.env.AZURE_PASSWORD_B64;
const AZURE_EMAIL =
  process.env.AZURE_EMAIL || "npm requires email to be set but does not use the value";

const args = new Set(cliArgs);
const dryRun = args.has("--dry-run");
const allVersions = args.has("--all-versions");
const failFast = args.has("--fail-fast");
const useLocalNodeModules = args.has("--from-node-modules") || !FONTAWESOME_TOKEN;

function resolveArgValue(flagName) {
  for (let i = 0; i < cliArgs.length; i += 1) {
    const arg = cliArgs[i];
    if (arg === flagName && cliArgs[i + 1]) {
      return cliArgs[i + 1];
    }
    if (arg.startsWith(`${flagName}=`)) {
      return arg.slice(flagName.length + 1);
    }
  }
  return null;
}

const nodeModulesDirFromArg = resolveArgValue("--node-modules-dir");
const effectiveNodeModulesDir = path.resolve(
  process.cwd(),
  nodeModulesDirFromArg || LOCAL_NODE_MODULES_DIR
);

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function npmrcKeyForRegistry(value) {
  return `//${value.replace(/^https?:\/\//, "")}`;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    ...options,
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const error = new Error(`Command failed: ${command} ${commandArgs.join(" ")}\n${output}`);
    error.code = result.status;
    throw error;
  }

  return (result.stdout || "").trim();
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} while requesting ${url}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

async function listFortawesomePackages() {
  const packages = [];
  const size = 250;
  let from = 0;

  while (true) {
    const searchUrl = `${SOURCE_REGISTRY}-/v1/search?text=${encodeURIComponent(
      "scope:@fortawesome"
    )}&size=${size}&from=${from}`;

    const payload = await fetchJson(searchUrl, {
      authorization: `Bearer ${FONTAWESOME_TOKEN}`,
      accept: "application/json",
    });

    const objects = Array.isArray(payload.objects) ? payload.objects : [];
    for (const item of objects) {
      const name = item?.package?.name;
      if (typeof name === "string" && name.startsWith("@fortawesome/")) {
        packages.push(name);
      }
    }

    if (objects.length < size) {
      break;
    }
    from += size;
  }

  return [...new Set(packages)].sort();
}

function listLocalFortawesomePackages(baseDir) {
  if (!existsSync(baseDir)) {
    throw new Error(`Local @fortawesome directory not found: ${baseDir}`);
  }

  const entries = readdirSync(baseDir, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(baseDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof packageJson.name !== "string" || !packageJson.name.startsWith("@fortawesome/")) {
      continue;
    }

    if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
      continue;
    }

    packages.push({
      name: packageJson.name,
      version: packageJson.version,
      packageDir,
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function npmView(name, selector, userConfigPath, registry) {
  return run("npm", [
    "view",
    selector ? `${name}@${selector}` : name,
    "version",
    "--json",
    "--registry",
    registry,
    "--userconfig",
    userConfigPath,
  ]);
}

function npmViewVersions(name, userConfigPath, registry) {
  const output = run("npm", [
    "view",
    name,
    "versions",
    "--json",
    "--registry",
    registry,
    "--userconfig",
    userConfigPath,
  ]);

  const parsed = JSON.parse(output);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (typeof parsed === "string") {
    return [parsed];
  }
  throw new Error(`Unexpected versions payload for ${name}`);
}

function targetHasVersion(name, version, userConfigPath) {
  try {
    const output = npmView(name, version, userConfigPath, TARGET_REGISTRY);
    return output.includes(version);
  } catch {
    return false;
  }
}

function npmPack(name, version, userConfigPath, destinationDir) {
  const output = run("npm", [
    "pack",
    `${name}@${version}`,
    "--registry",
    SOURCE_REGISTRY,
    "--userconfig",
    userConfigPath,
    "--pack-destination",
    destinationDir,
  ]);

  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const filename = lines[lines.length - 1];
  if (!filename || !filename.endsWith(".tgz")) {
    throw new Error(`Could not determine tarball filename for ${name}@${version}`);
  }
  return path.join(destinationDir, filename);
}

function npmPackFromLocal(packageDir, destinationDir) {
  const output = run("npm", [
    "pack",
    packageDir,
    "--pack-destination",
    destinationDir,
    "--ignore-scripts",
  ]);
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const filename = lines[lines.length - 1];
  if (!filename || !filename.endsWith(".tgz")) {
    throw new Error(`Could not determine tarball filename for local package: ${packageDir}`);
  }
  return path.join(destinationDir, filename);
}

function npmPublish(tarballPath, userConfigPath) {
  run("npm", [
    "publish",
    tarballPath,
    "--registry",
    TARGET_REGISTRY,
    "--userconfig",
    userConfigPath,
    "--ignore-scripts",
  ]);
}

async function main() {
  if (!AZURE_PASSWORD_B64) {
    throw new Error(
      "Missing AZURE_PASSWORD_B64. Set it in shell, .env, packages/paperlesspaper-web/.env, or pass --env-file <path>."
    );
  }
  if (!useLocalNodeModules && !FONTAWESOME_TOKEN) {
    throw new Error(
      "Missing FONTAWESOME_TOKEN. Set it in shell/.env or use --from-node-modules."
    );
  }

  if (allVersions && useLocalNodeModules) {
    console.warn("--all-versions is ignored in local node_modules mode (installed versions only).");
  }

  const sourceRegistry = ensureTrailingSlash(SOURCE_REGISTRY);
  const targetRegistry = ensureTrailingSlash(TARGET_REGISTRY);
  const targetNpmEndpoint = targetRegistry.replace(/\/registry\/$/, "/npm/");

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fortawesome-mirror-"));
  const tarballDir = path.join(tempRoot, "tarballs");
  const userConfigPath = path.join(tempRoot, ".npmrc");

  writeFileSync(
    userConfigPath,
    [
      "always-auth=true",
      ...(useLocalNodeModules
        ? []
        : [
            `@fortawesome:registry=${sourceRegistry}`,
            `${npmrcKeyForRegistry(sourceRegistry)}:_authToken=${FONTAWESOME_TOKEN}`,
          ]),
      `${npmrcKeyForRegistry(targetRegistry)}:username=${AZURE_USERNAME}`,
      `${npmrcKeyForRegistry(targetRegistry)}:_password=${AZURE_PASSWORD_B64}`,
      `${npmrcKeyForRegistry(targetRegistry)}:email=${AZURE_EMAIL}`,
      `${npmrcKeyForRegistry(targetNpmEndpoint)}:username=${AZURE_USERNAME}`,
      `${npmrcKeyForRegistry(targetNpmEndpoint)}:_password=${AZURE_PASSWORD_B64}`,
      `${npmrcKeyForRegistry(targetNpmEndpoint)}:email=${AZURE_EMAIL}`,
      "",
    ].join("\n"),
    "utf8"
  );

  run("mkdir", ["-p", tarballDir]);

  console.log(`Source mode: ${useLocalNodeModules ? "local node_modules" : "fontawesome registry"}`);
  if (useLocalNodeModules) {
    console.log(`Local path: ${effectiveNodeModulesDir}`);
  } else {
    console.log(`Source registry: ${sourceRegistry}`);
  }
  console.log(`Target registry: ${targetRegistry}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "publish"}`);
  console.log(
    `Versions mode: ${useLocalNodeModules ? "installed only" : allVersions ? "all versions" : "latest only"}`
  );

  const localPackages = useLocalNodeModules ? listLocalFortawesomePackages(effectiveNodeModulesDir) : [];
  const packageNames = useLocalNodeModules
    ? localPackages.map((pkg) => pkg.name)
    : await listFortawesomePackages();

  console.log(`Found ${packageNames.length} package(s) in @fortawesome scope.`);

  let published = 0;
  let skipped = 0;
  let failed = 0;
  let planned = 0;

  try {
    if (useLocalNodeModules) {
      for (const pkg of localPackages) {
        const label = `${pkg.name}@${pkg.version}`;
        if (targetHasVersion(pkg.name, pkg.version, userConfigPath)) {
          console.log(`skip ${label} (already in target)`);
          skipped += 1;
          continue;
        }

        if (dryRun) {
          console.log(`plan ${label}`);
          planned += 1;
          continue;
        }

        try {
          console.log(`pack ${label}`);
          const tarballPath = npmPackFromLocal(pkg.packageDir, tarballDir);
          console.log(`publish ${label}`);
          npmPublish(tarballPath, userConfigPath);
          published += 1;
        } catch (error) {
          failed += 1;
          console.error(`failed ${label}`);
          console.error(error.message || error);
          if (failFast) {
            throw error;
          }
        }
      }
    } else {
      for (const packageName of packageNames) {
        let versionsToMirror;
        if (allVersions) {
          versionsToMirror = npmViewVersions(packageName, userConfigPath, sourceRegistry);
        } else {
          const latest = JSON.parse(npmView(packageName, null, userConfigPath, sourceRegistry));
          versionsToMirror = [latest];
        }

        for (const version of versionsToMirror) {
          const label = `${packageName}@${version}`;
          if (targetHasVersion(packageName, version, userConfigPath)) {
            console.log(`skip ${label} (already in target)`);
            skipped += 1;
            continue;
          }

          if (dryRun) {
            console.log(`plan ${label}`);
            planned += 1;
            continue;
          }

          try {
            console.log(`pack ${label}`);
            const tarballPath = npmPack(packageName, version, userConfigPath, tarballDir);
            console.log(`publish ${label}`);
            npmPublish(tarballPath, userConfigPath);
            published += 1;
          } catch (error) {
            failed += 1;
            console.error(`failed ${label}`);
            console.error(error.message || error);
            if (failFast) {
              throw error;
            }
          }
        }
      }
    }

    console.log("Summary");
    console.log(`  published: ${published}`);
    console.log(`  skipped:   ${skipped}`);
    console.log(`  planned:   ${planned}`);
    console.log(`  failed:    ${failed}`);

    if (failed > 0) {
      process.exitCode = 2;
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
