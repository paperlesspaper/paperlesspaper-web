import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(packageRoot, "package.json");

const INTERNETDERDINGE_DEP_NAME = "@internetderdinge/api";
const YALC_DEP_VALUE = "file:.yalc/@internetderdinge/api";
const NPM_REGISTRY_HOST = "registry.npmjs.org";

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const setInternetderdingeDependency = (value) => {
  const packageJson = readJson(packageJsonPath);
  packageJson.dependencies = packageJson.dependencies ?? {};
  packageJson.dependencies[INTERNETDERDINGE_DEP_NAME] = value;
  writeJson(packageJsonPath, packageJson);
};

const resolveInternetderdingeApiPath = () => {
  if (process.env.INTERNETDERDINGE_API_PATH) {
    return path.resolve(process.env.INTERNETDERDINGE_API_PATH);
  }

  return path.resolve(
    packageRoot,
    "../../../internetderdinge/internetderdinge-api",
  );
};

const resolveNpmToken = () => {
  return (
    process.env.NPM_TOKEN?.trim() ||
    process.env.INTERNETDERDINGE_NPM_TOKEN?.trim() ||
    ""
  );
};

const hasNpmAuthToken = (npmrcPath) => {
  if (!npmrcPath || !fs.existsSync(npmrcPath)) {
    return false;
  }

  const content = fs.readFileSync(npmrcPath, "utf8");
  return content.includes(`//${NPM_REGISTRY_HOST}/:_authToken=`);
};

const resolveNpmrcPath = (internetderdingeApiPath) => {
  const explicitFromEnv =
    process.env.NPM_CONFIG_USERCONFIG || process.env.npm_config_userconfig;

  if (explicitFromEnv && hasNpmAuthToken(explicitFromEnv)) {
    return explicitFromEnv;
  }

  const candidates = [
    path.join(internetderdingeApiPath, ".npmrc"),
    path.join(os.homedir(), ".npmrc"),
  ];

  return candidates.find((candidate) => hasNpmAuthToken(candidate)) || "";
};

const publishToNpmWithToken = (cwd, token) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "internetderdinge-npm-"),
  );
  const tempNpmrcPath = path.join(tempDir, ".npmrc");

  fs.writeFileSync(
    tempNpmrcPath,
    `//${NPM_REGISTRY_HOST}/:_authToken=${token}\nalways-auth=true\nregistry=https://${NPM_REGISTRY_HOST}/\n`,
    "utf8",
  );

  const publishEnv = {
    ...process.env,
    npm_config_userconfig: tempNpmrcPath,
    npm_config_registry: `https://${NPM_REGISTRY_HOST}/`,
    NPM_CONFIG_REGISTRY: `https://${NPM_REGISTRY_HOST}/`,
  };

  try {
    execSync("npm publish", {
      cwd,
      stdio: "inherit",
      env: publishEnv,
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const publishToNpmWithNpmrc = (cwd, npmrcPath) => {
  const publishEnv = {
    ...process.env,
    npm_config_userconfig: npmrcPath,
    npm_config_registry: `https://${NPM_REGISTRY_HOST}/`,
    NPM_CONFIG_REGISTRY: `https://${NPM_REGISTRY_HOST}/`,
  };

  execSync("npm publish", {
    cwd,
    stdio: "inherit",
    env: publishEnv,
  });
};

const main = () => {
  const rawArgs = process.argv.slice(2);
  const commandArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const deployCommand = commandArgs.join(" ").trim();
  if (!deployCommand) {
    throw new Error("Missing deploy command. Example: -- fly deploy");
  }

  const internetderdingeApiPath = resolveInternetderdingeApiPath();
  const internetderdingePackageJsonPath = path.join(
    internetderdingeApiPath,
    "package.json",
  );

  if (!fs.existsSync(internetderdingePackageJsonPath)) {
    throw new Error(
      `Could not find @internetderdinge/api package.json at ${internetderdingePackageJsonPath}. Set INTERNETDERDINGE_API_PATH if needed.`,
    );
  }

  const currentPackageJson = readJson(packageJsonPath);
  const originalDependency =
    currentPackageJson.dependencies?.[INTERNETDERDINGE_DEP_NAME];

  if (!originalDependency) {
    throw new Error(
      `Missing ${INTERNETDERDINGE_DEP_NAME} dependency in ${packageJsonPath}`,
    );
  }

  const npmToken = resolveNpmToken();
  const npmrcPath = resolveNpmrcPath(internetderdingeApiPath);

  try {
    execSync("yarn build", {
      cwd: internetderdingeApiPath,
      stdio: "inherit",
    });

    if (npmToken) {
      publishToNpmWithToken(internetderdingeApiPath, npmToken);
    } else if (npmrcPath) {
      publishToNpmWithNpmrc(internetderdingeApiPath, npmrcPath);
    } else {
      throw new Error(
        "Missing npm publish auth. Set NPM_TOKEN / INTERNETDERDINGE_NPM_TOKEN or configure //registry.npmjs.org/:_authToken in .npmrc.",
      );
    }

    const internetderdingePackageJson = readJson(
      internetderdingePackageJsonPath,
    );
    const publishedVersion = internetderdingePackageJson.version;

    if (!publishedVersion) {
      throw new Error(
        "Could not resolve published @internetderdinge/api version",
      );
    }

    setInternetderdingeDependency(publishedVersion);

    execSync(deployCommand, {
      cwd: packageRoot,
      stdio: "inherit",
    });
  } finally {
    if (originalDependency !== YALC_DEP_VALUE) {
      console.warn(
        `Expected ${INTERNETDERDINGE_DEP_NAME} to be ${YALC_DEP_VALUE}, found ${originalDependency}. Restoring yalc dependency anyway.`,
      );
    }

    setInternetderdingeDependency(YALC_DEP_VALUE);
  }
};

main();
