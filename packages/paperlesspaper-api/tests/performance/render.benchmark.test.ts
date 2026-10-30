import { expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const exec = promisify(execFile);
const enabled = process.env.RUN_RENDER_BENCHMARK === "true";
const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)] ?? 0
  );
};
const round = (value: number) => Math.round(value * 10) / 10;

it.skipIf(!enabled)(
  "benchmarks render latency, cache effects, concurrency and resources",
  async () => {
    const output = process.env.RENDER_BENCHMARK_OUTPUT!;
    const old = await import(process.env.RENDER_BENCHMARK_BASELINE_MODULE!);
    const current = await import(process.env.RENDER_BENCHMARK_CURRENT_MODULE!);
    const modules = { baseline: old, hardened: current };
    const summary: any = {
      startedAt: new Date().toISOString(),
      baselineRef: process.env.RENDER_BENCHMARK_BASE_REF,
      provenance: JSON.parse(process.env.RENDER_BENCHMARK_PROVENANCE || "{}"),
      counts: { renders: 0, failures: 0 },
      machine: {
        platform: os.platform(),
        architecture: os.arch(),
        cpu: os.cpus()[0].model,
        cpuCount: os.cpus().length,
        memoryGiB: round(os.totalmem() / 2 ** 30),
        node: process.version,
      },
      methodology:
        "Alternating paired runs. Two warmups per case/variant excluded. Live endpoints sequential only. Fixture assets served by a separate Node process. Latency includes cleanup. No API upload, database or dithering in measured path.",
      scenarios: [],
      resourceRuns: [],
      startup: [],
      samples: [],
    };
    const persist = () =>
      fs.writeFile(
        path.join(output, "results.json"),
        JSON.stringify(summary, null, 2)
      );
    const progress = (message: string) =>
      process.stdout.write(`BENCHMARK ${message}\n`);
    const pngFile = path.join(output, "fixture.png");
    const canvas = createCanvas(256, 256),
      ctx = canvas.getContext("2d"),
      pixels = ctx.createImageData(256, 256);
    let random = 123456789;
    for (let i = 0; i < pixels.data.length; i += 4) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      pixels.data[i] = random & 255;
      pixels.data[i + 1] = (random >>> 8) & 255;
      pixels.data[i + 2] = (random >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    await fs.writeFile(pngFile, canvas.toBuffer("image/png"));
    const fixture = spawn(
      process.execPath,
      [path.join(import.meta.dirname, "fixtures/render-server.mjs"), pngFile],
      { stdio: ["ignore", "pipe", "inherit"] }
    );
    const port = await new Promise<string>((resolve, reject) => {
      fixture.once("error", reject);
      fixture.stdout!.once("data", (chunk) => resolve(chunk.toString().trim()));
      fixture.once("exit", (code) =>
        reject(new Error(`Fixture exited: ${code}`))
      );
    });
    const origin = `http://127.0.0.1:${port}`;
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RENDER_ALLOWED_PRIVATE_ORIGINS", origin);
    vi.stubEnv(
      "PAPERLESSPAPER_APPS_URL",
      process.env.RENDER_BENCHMARK_COMPARE_CACHE === "true"
        ? origin
        : "https://apps.paperlesspaper.de"
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fixtureUrl = (scenario: any, variant: string, iteration: number) =>
      `${origin}/?${new URLSearchParams({
        heavy: scenario.heavy ? "1" : "0",
        latency: String(scenario.latency || 0),
        group: `${scenario.id}-${variant}`,
        version: scenario.cold ? String(iteration) : "cached",
      })}`;
    const render = async (
      variant: keyof typeof modules,
      scenario: any,
      iteration: number,
      record = true
    ) => {
      if (process.env.RENDER_BENCHMARK_COMPARE_CACHE === "true")
        vi.stubEnv(
          "RENDER_STATIC_CACHE_DISABLED",
          String(variant === "baseline")
        );
      const started = performance.now();
      const options = scenario.options || {
        kind: "epd7",
        paper: { kind: "plugin" },
        data: { settings: {} },
      };
      const result = await modules[variant].default.generateImageFromUrl({
        ...options,
        url: scenario.url || fixtureUrl(scenario, variant, iteration),
        timezone: "Europe/Berlin",
      });
      const sample = {
        scenario: scenario.id,
        variant,
        iteration,
        wallMs: performance.now() - started,
        outcome: result.diagnostics.outcome,
        pageState: result.diagnostics.pageState.status,
        imageBytes: result.buffer?.length || 0,
        timings: result.diagnostics.timings,
        assetCache: result.diagnostics.assetCache,
        error: result.diagnostics.error?.message,
      };
      summary.counts.renders++;
      if (
        sample.outcome !== "success" ||
        sample.pageState === "error" ||
        !sample.imageBytes
      )
        summary.counts.failures++;
      if (record) summary.samples.push(sample);
      return sample;
    };
    const statistics = (samples: any[]) => ({
      n: samples.length,
      failures: samples.filter(
        (s) => s.outcome !== "success" || s.pageState === "error"
      ).length,
      medianMs: round(
        quantile(
          samples.map((s) => s.wallMs),
          0.5
        )
      ),
      p95Ms: round(
        quantile(
          samples.map((s) => s.wallMs),
          0.95
        )
      ),
      minMs: round(Math.min(...samples.map((s) => s.wallMs))),
      maxMs: round(Math.max(...samples.map((s) => s.wallMs))),
      stagesMedianMs: Object.fromEntries(
        [
          "browserMs",
          "pageCreationMs",
          "navigationMs",
          "networkIdleMs",
          "preInitDelayMs",
          "readinessWaitMs",
          "screenshotMs",
        ].map((key) => [
          key,
          round(
            quantile(
              samples.map((s) => s.timings[key] || 0),
              0.5
            )
          ),
        ])
      ),
    });
    const counters = async () => await (await fetch(`${origin}/stats`)).json();
    const runScenario = async (scenario: any) => {
      for (const variant of ["baseline", "hardened"] as const)
        for (let i = -2; i < 0; i++) await render(variant, scenario, i, false);
      const before = await counters();
      const samples: any = { baseline: [], hardened: [] };
      for (let i = 0; i < scenario.n; i++) {
        for (const variant of (i % 2
          ? ["hardened", "baseline"]
          : ["baseline", "hardened"]) as Array<keyof typeof modules>)
          samples[variant].push(await render(variant, scenario, i));
      }
      const after = await counters();
      const result: any = {
        id: scenario.id,
        description: scenario.description,
        latencyPerAssetMs: scenario.latency || 0,
      };
      for (const variant of ["baseline", "hardened"]) {
        const key = `${scenario.id}-${variant}`;
        result[variant] = {
          ...statistics(samples[variant]),
          assetRequests:
            (after[key]?.requests || 0) - (before[key]?.requests || 0),
          assetBytes: (after[key]?.bytes || 0) - (before[key]?.bytes || 0),
        };
      }
      result.deltaMs = round(
        result.hardened.medianMs - result.baseline.medianMs
      );
      result.deltaPercent = round(
        (100 * result.deltaMs) / result.baseline.medianMs
      );
      summary.scenarios.push(result);
      await persist();
      progress(
        `${scenario.id}: ${result.baseline.medianMs} -> ${result.hardened.medianMs} ms (${result.deltaPercent}%), failures ${result.baseline.failures}/${result.hardened.failures}`
      );
    };
    try {
      const simple = { id: "startup", n: 1 };
      for (let i = 0; i < 4; i++)
        for (const variant of (i % 2
          ? ["hardened", "baseline"]
          : ["baseline", "hardened"]) as Array<keyof typeof modules>) {
          await modules[variant].benchmarkCloseBrowser();
          const sample = await render(variant, simple, i, false);
          summary.startup.push({
            variant,
            wallMs: round(sample.wallMs),
            browserMs: sample.timings.browserMs,
          });
        }
      summary.browserVersion = await current.benchmarkBrowser().version();
      progress("Browser startup measurements completed");
      for (const scenario of [
        {
          id: "small-repeated",
          description: "Small cached fixture; 2 assets",
          n: 20,
        },
        {
          id: "heavy-repeated-local",
          description: "Cached fixture; 16 PNGs, 4 scripts, 2 stylesheets",
          n: 15,
          heavy: true,
        },
        {
          id: "heavy-repeated-80ms",
          description:
            "Same rich page repeatedly, 80 ms simulated asset response latency",
          n: 15,
          heavy: true,
          latency: 80,
        },
        {
          id: "heavy-fresh-80ms",
          description:
            "New asset URLs on each render, 80 ms simulated response latency",
          n: 15,
          heavy: true,
          latency: 80,
          cold: true,
        },
      ])
        await runScenario(scenario);

      // Local-only bursts; never load-test the publicly hosted integrations.
      for (const { concurrency, cold } of [
        { concurrency: 2, cold: false },
        { concurrency: 4, cold: false },
        { concurrency: 2, cold: true },
        { concurrency: 4, cold: true },
      ]) {
        const scenario = {
          id: `parallel-${concurrency}${cold ? "-fresh" : ""}`,
          heavy: true,
          latency: 80,
          cold,
        };
        for (const variant of ["baseline", "hardened"] as const)
          await render(variant, scenario, -1, false);
        const durations: any = { baseline: [], hardened: [] },
          samples: any = { baseline: [], hardened: [] };
        const before = await counters();
        for (let batch = 0; batch < 8; batch++)
          for (const variant of (batch % 2
            ? ["hardened", "baseline"]
            : ["baseline", "hardened"]) as Array<keyof typeof modules>) {
            const start = performance.now();
            samples[variant].push(
              ...(await Promise.all(
                Array.from({ length: concurrency }, (_, i) =>
                  render(variant, scenario, batch * concurrency + i)
                )
              ))
            );
            durations[variant].push(performance.now() - start);
          }
        const after = await counters();
        const result: any = { id: scenario.id, concurrency, cold, batches: 8 };
        for (const variant of ["baseline", "hardened"]) {
          const key = `${scenario.id}-${variant}`;
          result[variant] = {
            ...statistics(samples[variant]),
            batchMedianMs: round(quantile(durations[variant], 0.5)),
            jobsPerSecond: round(
              samples[variant].length /
                (durations[variant].reduce((a: number, b: number) => a + b, 0) /
                  1000)
            ),
            assetRequests:
              (after[key]?.requests || 0) - (before[key]?.requests || 0),
          };
        }
        summary.scenarios.push(result);
        await persist();
        progress(
          `${scenario.id}: throughput ${result.baseline.jobsPerSecond} -> ${result.hardened.jobsPerSecond} jobs/s`
        );
      }

      // Separate resource observations so ps/CDP sampling does not distort timing series.
      for (const variant of ["baseline", "hardened"] as const) {
        const browser = modules[variant].benchmarkBrowser();
        const cdp = await browser.target().createCDPSession();
        const initial = new Map(
          (await cdp.send("SystemInfo.getProcessInfo")).processInfo.map(
            (p: any) => [p.id, p.cpuTime]
          )
        );
        const maxCpu = new Map<number, number>();
        let peakRssKiB = 0,
          nodePeakRss = process.memoryUsage().rss,
          polls = 0,
          polling = false;
        const poll = async () => {
          if (polling) return;
          polling = true;
          try {
            const info = (await cdp.send("SystemInfo.getProcessInfo"))
              .processInfo;
            const ids = new Set(info.map((p: any) => p.id));
            for (const p of info)
              maxCpu.set(
                p.id,
                Math.max(
                  maxCpu.get(p.id) || 0,
                  p.cpuTime - ((initial.get(p.id) as number) || 0)
                )
              );
            const { stdout } = await exec("ps", ["-axo", "pid=,rss="]);
            const rss = stdout
              .trim()
              .split("\n")
              .reduce((sum, line) => {
                const [pid, kb] = line.trim().split(/\s+/).map(Number);
                return sum + (ids.has(pid) ? kb : 0);
              }, 0);
            peakRssKiB = Math.max(peakRssKiB, rss);
            nodePeakRss = Math.max(nodePeakRss, process.memoryUsage().rss);
            polls++;
          } finally {
            polling = false;
          }
        };
        const eventLoop = monitorEventLoopDelay({ resolution: 10 });
        eventLoop.enable();
        const nodeCpu = process.cpuUsage(),
          start = performance.now();
        await poll();
        const timer = setInterval(() => {
          void poll().catch(() => {});
        }, 200);
        try {
          for (let batch = 0; batch < 3; batch++)
            await Promise.all(
              Array.from({ length: 4 }, (_, i) =>
                render(
                  variant,
                  {
                    id: "resource-4-fresh",
                    heavy: true,
                    latency: 80,
                    cold: true,
                  },
                  batch * 4 + i,
                  false
                )
              )
            );
        } finally {
          clearInterval(timer);
          while (polling) await new Promise((r) => setTimeout(r, 10));
          await poll();
          eventLoop.disable();
          await cdp.detach();
        }
        const cpu = process.cpuUsage(nodeCpu);
        summary.resourceRuns.push({
          variant,
          jobs: 12,
          concurrency: 4,
          wallMs: round(performance.now() - start),
          nodeCpuMs: round((cpu.user + cpu.system) / 1000),
          browserCpuSecondsSampled: round(
            [...maxCpu.values()].reduce((a, b) => a + b, 0)
          ),
          browserPeakSumRssMiB: round(peakRssKiB / 1024),
          nodePeakRssMiB: round(nodePeakRss / 2 ** 20),
          eventLoopP95Ms: round(eventLoop.percentile(95) / 1e6),
          polls,
          note: "Sampled browser CPU can miss short-lived processes; summed RSS double-counts shared pages. Node stats include benchmark instrumentation, not fixture server. Single observation per variant.",
        });
        await persist();
        progress(`Resource observation completed: ${variant}`);
      }

      if (process.env.RENDER_BENCHMARK_LIVE === "true") {
        vi.stubEnv("PAPERLESSPAPER_APPS_URL", "https://apps.paperlesspaper.de");
        await runScenario({
          id: "live-calendar",
          description: "Public calendar integration",
          n: 8,
          url: "https://apps.paperlesspaper.de/calendar?language=de&kind=month",
          options: {
            kind: "epd7",
            paper: {
              kind: "calendar",
              meta: { language: "de", kind: "month" },
            },
          },
        });
        const start = new Date();
        start.setHours(14, 0, 0, 0);
        const data = Array.from({ length: 12 }, (_, i) => ({
          id: `benchmark-${i}`,
          summary: `Synthetic appointment ${i + 1}`,
          start: { dateTime: new Date(+start + i * 86400000).toISOString() },
          end: {
            dateTime: new Date(+start + i * 86400000 + 3600000).toISOString(),
          },
        }));
        await runScenario({
          id: "live-google-calendar",
          description:
            "Public Google Calendar integration with synthetic events, no OAuth",
          n: 8,
          url: "https://apps.paperlesspaper.de/google-calendar?language=de&dayRange=14",
          options: {
            kind: "epd7",
            paper: {
              kind: "google-calendar",
              meta: { language: "de", dayRange: 14 },
            },
            data,
          },
        });
        await runScenario({
          id: "live-ordinary-website",
          description:
            "Ordinary website without readiness markers; existing fixed waits included",
          n: 3,
          url: "https://example.com",
          options: { kind: "epd7" },
        });
      }
      summary.finishedAt = new Date().toISOString();
      await persist();
      expect(
        summary.counts.failures,
        "Every benchmark render must succeed"
      ).toBe(0);
      progress("All benchmark scenarios completed");
    } finally {
      await old.benchmarkCloseBrowser();
      await current.benchmarkCloseBrowser();
      fixture.kill("SIGTERM");
      await new Promise<void>((resolve) =>
        fixture.once("exit", () => resolve())
      );
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  },
  600_000
);
