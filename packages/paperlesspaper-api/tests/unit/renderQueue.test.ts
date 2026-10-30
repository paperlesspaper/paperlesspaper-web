import { afterEach, expect, it, vi } from "vitest";
import { createRenderQueue } from "../../src/render/renderQueue";

afterEach(() => vi.useRealTimers());

it("drains a cronjob burst in order with at most two active renders", async () => {
  const run = createRenderQueue();
  let active = 0;
  let peak = 0;
  const results = await Promise.all(
    Array.from({ length: 300 }, (_, i) =>
      run(async () => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setImmediate(resolve));
        active--;
        return i;
      }, 100)
    )
  );
  expect(peak).toBe(2);
  expect(results).toEqual(Array.from({ length: 300 }, (_, i) => i));
});

it("releases capacity after a failed render", async () => {
  const run = createRenderQueue({ concurrency: 1 });
  const failed = expect(
    run(async () => {
      throw new Error("unavailable");
    }, 1)
  ).rejects.toThrow("unavailable");
  const next = run(async () => "recovered", 1);
  await failed;
  expect(await next).toBe("recovered");
});

it("bounds queued payload bytes and count and never runs expired requests", async () => {
  vi.useFakeTimers();
  const run = createRenderQueue({
    concurrency: 1,
    maxPending: 1,
    maxPendingBytes: 10,
    waitMs: 100,
  });
  let finish!: () => void;
  const first = run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    1
  );
  await Promise.resolve();
  await expect(run(async () => {}, 11)).rejects.toThrow("queue full");
  const expired = vi.fn(async () => {});
  const waiting = expect(run(expired, 10)).rejects.toThrow("wait timed out");
  await expect(run(async () => {}, 1)).rejects.toThrow("queue full");
  await vi.advanceTimersByTimeAsync(100);
  await waiting;
  finish();
  await first;
  expect(await run(async () => "next", 10)).toBe("next");
  expect(expired).not.toHaveBeenCalled();
});
