#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DEP_PREFIX = "@internetderdinge/";
const TARGET_PACKAGE_JSON_CANDIDATES = [
  "packages/web/package.json",
  "packages/api/package.json",
  // Fallbacks for current repo naming.
  "packages/paperlesspaper-web/package.json",
  "packages/paperlesspaper-api/package.json",
];
const STATE_FILE_RELATIVE = ".git/.internetderdinge-api-hook-state.json";
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "resolutions",
  "overrides",
];

const repoRoot = execSync("git rev-parse --show-toplevel", {
  encoding: "utf8",
}).trim();
const statePath = path.join(repoRoot, STATE_FILE_RELATIVE);

const mode = process.argv[2];
if (!mode || (mode !== "pre-commit" && mode !== "post-commit")) {
  console.error(
    "Usage: node scripts/git-hook-internetderdinge-api-dep.mjs <pre-commit|post-commit>",
  );
  process.exit(1);
}

const resolveTargetPackageJsons = () => {
  const existing = TARGET_PACKAGE_JSON_CANDIDATES.filter((relativePath) =>
    fs.existsSync(path.join(repoRoot, relativePath)),
  );

  // De-duplicate while preserving order.
  return [...new Set(existing)];
};

const readPackageJson = (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
};

const writePackageJson = (relativePath, data) => {
  const absolutePath = path.join(repoRoot, relativePath);
  fs.writeFileSync(
    absolutePath,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
};

const resolveLiveVersion = (depName) => {
  const depSuffix = depName.replace(DEP_PREFIX, "").replace(/[^A-Za-z0-9]+/g, "_");
  const envName = `INTERNETDERDINGE_${depSuffix.toUpperCase()}_LIVE_VERSION`;

  const fromSpecificEnv = process.env[envName]?.trim();
  if (fromSpecificEnv) {
    return fromSpecificEnv;
  }

  const fromEnv = process.env.INTERNETDERDINGE_LIVE_VERSION?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const npmVersion = execSync(`npm view ${depName} version`, {
    encoding: "utf8",
  }).trim();

  if (!npmVersion) {
    throw new Error(
      `Could not resolve latest published ${depName} version from npm`,
    );
  }

  return npmVersion;
};

const shouldSwitchSpec = (spec) => {
  if (typeof spec !== "string") {
    return false;
  }

  if (spec.includes(".yalc/")) {
    return true;
  }

  return spec.startsWith("file:") || spec.startsWith("link:");
};

const collectInternetderdingeRefs = (pkg) => {
  const refs = [];

  for (const field of DEP_FIELDS) {
    const entries = pkg[field];
    if (!entries || typeof entries !== "object") {
      continue;
    }

    for (const [depName, spec] of Object.entries(entries)) {
      if (!depName.startsWith(DEP_PREFIX)) {
        continue;
      }

      refs.push({ field, depName, spec });
    }
  }

  return refs;
};

const preCommit = () => {
  const targetPackageJsons = resolveTargetPackageJsons();
  const stateChanges = [];

  if (targetPackageJsons.length === 0) {
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath, { force: true });
    }
    console.warn("[hook] No target package.json files found under packages/web or packages/api.");
    return;
  }

  for (const packageJsonRelativePath of targetPackageJsons) {
    const pkg = readPackageJson(packageJsonRelativePath);
    const refs = collectInternetderdingeRefs(pkg);
    let changed = false;

    for (const ref of refs) {
      if (!shouldSwitchSpec(ref.spec)) {
        continue;
      }

      const liveVersion = resolveLiveVersion(ref.depName);
      pkg[ref.field][ref.depName] = liveVersion;
      changed = true;

      stateChanges.push({
        file: packageJsonRelativePath,
        field: ref.field,
        depName: ref.depName,
        from: ref.spec,
        to: liveVersion,
      });
    }

    if (!changed) {
      continue;
    }

    writePackageJson(packageJsonRelativePath, pkg);
    execSync(`git add ${packageJsonRelativePath}`, { stdio: "inherit" });
  }

  if (stateChanges.length === 0) {
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath, { force: true });
    }
    console.log("[hook] No @internetderdinge/* local file/link refs needed switching.");
    return;
  }

  const state = {
    ts: Date.now(),
    changes: stateChanges,
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  console.log(`[hook] Switched ${stateChanges.length} @internetderdinge/* refs to live versions for commit.`);
};

const postCommit = () => {
  if (!fs.existsSync(statePath)) {
    return;
  }

  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const changes = Array.isArray(state.changes) ? state.changes : [];

  if (changes.length === 0) {
    fs.rmSync(statePath, { force: true });
    return;
  }

  const groupedByFile = changes.reduce((acc, entry) => {
    const key = entry.file;
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});

  for (const [relativePath, fileChanges] of Object.entries(groupedByFile)) {
    if (!fs.existsSync(path.join(repoRoot, relativePath))) {
      continue;
    }

    const pkg = readPackageJson(relativePath);
    let changed = false;

    for (const change of fileChanges) {
      const container = pkg[change.field];
      if (!container || typeof container !== "object") {
        continue;
      }

      if (container[change.depName] === change.to) {
        container[change.depName] = change.from;
        changed = true;
      }
    }

    if (changed) {
      writePackageJson(relativePath, pkg);
    }
  }

  fs.rmSync(statePath, { force: true });
  console.log(`[hook] Restored ${changes.length} @internetderdinge/* refs locally after commit.`);
};

console.log(`[hook] Running ${mode} hook for @internetderdinge/* dependency management...`);

if (mode === "pre-commit") {
  preCommit();
} else {
  postCommit();
}
