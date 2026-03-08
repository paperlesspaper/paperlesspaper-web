#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEP_NAME = '@internetderdinge/api';
const YALC_SPEC = 'file:.yalc/@internetderdinge/api';
const PACKAGE_JSON_RELATIVE = 'packages/paperlesspaper-api/package.json';
const STATE_FILE_RELATIVE = '.git/.internetderdinge-api-hook-state.json';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, PACKAGE_JSON_RELATIVE);
const statePath = path.join(repoRoot, STATE_FILE_RELATIVE);

const mode = process.argv[2];
if (!mode || (mode !== 'pre-commit' && mode !== 'post-commit')) {
  console.error('Usage: node scripts/git-hook-internetderdinge-api-dep.mjs <pre-commit|post-commit>');
  process.exit(1);
}

const readPackageJson = () => JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const writePackageJson = (data) => {
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const resolveLiveVersion = () => {
  const fromEnv = process.env.INTERNETDERDINGE_LIVE_VERSION?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const npmVersion = execSync('npm view @internetderdinge/api version', {
    encoding: 'utf8',
  }).trim();

  if (!npmVersion) {
    throw new Error('Could not resolve latest published @internetderdinge/api version from npm');
  }

  return npmVersion;
};

const preCommit = () => {
  const pkg = readPackageJson();
  const currentSpec = pkg.dependencies?.[DEP_NAME];

  if (!currentSpec) {
    console.warn(`[hook] ${DEP_NAME} not found in ${PACKAGE_JSON_RELATIVE}; skipping switch.`);
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath, { force: true });
    }
    return;
  }

  if (currentSpec !== YALC_SPEC) {
    // Nothing to switch. Clear stale state if present.
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath, { force: true });
    }
    return;
  }

  const liveVersion = resolveLiveVersion();
  pkg.dependencies[DEP_NAME] = liveVersion;
  writePackageJson(pkg);

  execSync(`git add ${PACKAGE_JSON_RELATIVE}`, { stdio: 'inherit' });

  const state = {
    switchedFrom: currentSpec,
    switchedTo: liveVersion,
    ts: Date.now(),
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  console.log(`[hook] Switched ${DEP_NAME} to live version ${liveVersion} for commit.`);
};

const postCommit = () => {
  if (!fs.existsSync(statePath)) {
    return;
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const pkg = readPackageJson();
  const currentSpec = pkg.dependencies?.[DEP_NAME];

  if (!currentSpec) {
    fs.rmSync(statePath, { force: true });
    return;
  }

  if (state.switchedFrom !== YALC_SPEC) {
    fs.rmSync(statePath, { force: true });
    return;
  }

  pkg.dependencies[DEP_NAME] = YALC_SPEC;
  writePackageJson(pkg);
  fs.rmSync(statePath, { force: true });

  console.log(`[hook] Restored ${DEP_NAME} to ${YALC_SPEC} locally after commit.`);
};

if (mode === 'pre-commit') {
  preCommit();
} else {
  postCommit();
}
