/** Preparation lead time, not a change to the device's sleep interval. */
export function slideshowPreparationMinutes(intervalSeconds: unknown): number {
  const seconds = Number(intervalSeconds);
  if (!Number.isFinite(seconds) || seconds <= 2 * 3600) return 5;
  if (seconds <= 8 * 3600) return 10;
  if (seconds < 24 * 3600) return 15;
  return 25;
}
