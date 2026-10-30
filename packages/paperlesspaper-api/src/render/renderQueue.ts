// Keep cronjob bursts in the trusted API instead of overwhelming Chromium.
// Both queue length and retained payload bytes are bounded; expired work is
// removed before it can render/upload after a caller has already failed.
export function createRenderQueue({
  concurrency = 2,
  maxPending = 300,
  maxPendingBytes = 32 * 1024 * 1024,
  waitMs = 4 * 60_000,
} = {}) {
  let active = 0;
  let pendingBytes = 0;
  const pending: Array<{ start: () => void; bytes: number }> = [];

  return function run<T>(
    operation: () => Promise<T>,
    bytes: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const entry = {
        bytes,
        start() {
          clearTimeout(timer);
          active++;
          void Promise.resolve()
            .then(operation)
            .then(resolve, reject)
            .finally(() => {
              active--;
              const next = pending.shift();
              if (next) {
                pendingBytes -= next.bytes;
                next.start();
              }
            });
        },
      };
      if (active < concurrency) {
        entry.start();
        return;
      }
      if (
        pending.length >= maxPending ||
        pendingBytes + bytes > maxPendingBytes
      ) {
        reject(new Error("Renderer queue full"));
        return;
      }
      pending.push(entry);
      pendingBytes += bytes;
      timer = setTimeout(() => {
        const index = pending.indexOf(entry);
        if (index < 0) return;
        pending.splice(index, 1);
        pendingBytes -= bytes;
        reject(new Error("Renderer queue wait timed out"));
      }, waitMs);
    });
  };
}
