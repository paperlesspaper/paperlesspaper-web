#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const lockfilePatterns = [
  /file:\s*\.yalc\//i,
  /\b\.yalc\//i,
  /\blink:\s*\.yalc\//i,
];

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "resolutions",
  "overrides",
];

const isForbiddenSpec = (spec) => {
  if (typeof spec !== "string") return false;

  return (
    spec.includes(".yalc/") ||
    spec.startsWith("file:") ||
    spec.startsWith("link:")
  );
};

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => {
    if (file.includes("/.yalc/")) return false;

    return (
      file.endsWith("package.json") ||
      file.endsWith("yarn.lock") ||
      file.endsWith("package-lock.json") ||
      file.endsWith("pnpm-lock.yaml")
    );
  });

const violations = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");

  if (file.endsWith("package.json")) {
    const pkg = JSON.parse(content);

    for (const field of dependencyFields) {
      const deps = pkg[field];
      if (!deps || typeof deps !== "object") {
        continue;
      }

      for (const [name, spec] of Object.entries(deps)) {
        if (!isForbiddenSpec(spec)) {
          continue;
        }

        violations.push({
          file,
          line: "?",
          text: `${field}.${name} = ${spec}`,
        });
      }
    }

    continue;
  }

  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (!lockfilePatterns.some((pattern) => pattern.test(line))) {
      return;
    }

    violations.push({ file, line: index + 1, text: line.trim() });
  });
}

if (violations.length > 0) {
  console.error(
    "Detected forbidden yalc/file/link references in tracked dependency files:",
  );

  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.text}`);
  }

  console.error(
    "\nUse published registry versions for CI/release runs. Keep yalc overrides local only.",
  );
  process.exit(1);
}

console.log("No yalc/file/link dependency references detected.");
