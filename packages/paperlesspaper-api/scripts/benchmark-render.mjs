import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(api, "../..");
const baselineRef = process.env.RENDER_BENCHMARK_BASE_REF || "HEAD";
const sourcePath = "packages/paperlesspaper-api/src/render/render.browser.ts";
const sourceDirectory = path.join(api, "src/render");
const suffix = `benchmark-${process.pid}`;
const baselinePath = path.join(sourceDirectory, `.${suffix}-baseline.ts`);
const currentPath = path.join(sourceDirectory, `.${suffix}-current.ts`);
const output = path.resolve(
  process.env.RENDER_BENCHMARK_OUTPUT ||
    path.join(
      root,
      "output/render-performance",
      new Date().toISOString().replace(/[:.]/g, "-")
    )
);
const accessors = `\nexport const benchmarkBrowser = () => sharedBrowser;
export const benchmarkCloseBrowser = async () => {
  const browser = sharedBrowser || await sharedBrowserPromise;
  sharedBrowser = null; sharedBrowserPromise = null;
  await browser?.close();
};\n`;

try {
  const newSource = await fs.readFile(path.join(root, sourcePath), "utf8");
  const compareCache = process.env.RENDER_BENCHMARK_COMPARE_CACHE === "true";
  let baselineSourcePath = sourcePath;
  try {
    execFileSync("git", ["cat-file", "-e", `${baselineRef}:${sourcePath}`], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    baselineSourcePath = sourcePath.replace(
      "render.browser.ts",
      "render.service.ts"
    );
  }
  const oldSource = compareCache
    ? newSource
    : execFileSync("git", ["show", `${baselineRef}:${baselineSourcePath}`], {
        cwd: root,
        encoding: "utf8",
      });
  const provenance = {
    comparison: compareCache
      ? "Current protected renderer: shared asset cache disabled versus enabled"
      : "Git reference versus working tree renderer",
    baselineCommit: execFileSync(
      "git",
      ["rev-parse", `${baselineRef}^{commit}`],
      { cwd: root, encoding: "utf8" }
    ).trim(),
    baselineSha256: createHash("sha256").update(oldSource).digest("hex"),
    currentSha256: createHash("sha256").update(newSource).digest("hex"),
  };
  for (const source of [oldSource, newSource]) {
    if (
      !source.includes("let sharedBrowser:") ||
      !source.includes("let sharedBrowserPromise:")
    ) {
      throw new Error(
        "Benchmark accessors need updating for this renderer version"
      );
    }
  }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(baselinePath, oldSource + accessors);
  await fs.writeFile(currentPath, newSource + accessors);
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "tests/performance/render.benchmark.test.ts",
      "--maxWorkers=1",
    ],
    {
      cwd: api,
      stdio: "inherit",
      env: {
        ...process.env,
        RUN_RENDER_BENCHMARK: "true",
        RENDER_BENCHMARK_BASELINE_MODULE: baselinePath,
        RENDER_BENCHMARK_CURRENT_MODULE: currentPath,
        RENDER_BENCHMARK_BASE_REF: baselineRef,
        RENDER_BENCHMARK_OUTPUT: output,
        RENDER_BENCHMARK_PROVENANCE: JSON.stringify(provenance),
      },
    }
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal));
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  console.log(`Benchmark artifacts: ${output}`);
} finally {
  await fs.rm(baselinePath, { force: true });
  await fs.rm(currentPath, { force: true });
}
