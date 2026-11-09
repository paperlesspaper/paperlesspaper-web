/** Onboarding hints are local to an account and this browser/app installation. */
export const UPLOAD_NOTICE_LIMIT = 10;
export type UploadNotice = {
  organization: string;
  frameIds: string[];
  addedToSlideshow: boolean;
};
const notices = new Map<string, UploadNotice>();
const counts = new Map<string, number>();
const listeners = new Set<() => void>();
const storageKey = (accountId: string) =>
  `paperlesspaper:upload-notice:v1:${accountId}`;

export function subscribeUploadNotice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const emit = () => listeners.forEach((listener) => listener());
export const getUploadNotice = (accountId?: string) =>
  accountId ? notices.get(accountId) : undefined;

export function dismissUploadNotice(accountId?: string) {
  if (accountId && notices.delete(accountId)) emit();
}

/** Call once per successfully uploaded image, never once per destination. */
export function recordSuccessfulUpload(
  accountId: string | undefined,
  notice: UploadNotice,
) {
  if (!accountId) return;
  let count = counts.get(accountId) || 0;
  try {
    const saved = localStorage.getItem(storageKey(accountId));
    if (saved !== null) {
      const parsed = Number(saved);
      count = Math.max(
        count,
        Number.isInteger(parsed) && parsed >= 0 ? parsed : UPLOAD_NOTICE_LIMIT,
      );
    }
  } catch {
    // Private browsing/storage failures must not turn a completed upload into an error.
  }
  const nextCount = Math.min(count + 1, UPLOAD_NOTICE_LIMIT);
  counts.set(accountId, nextCount);
  try {
    localStorage.setItem(storageKey(accountId), String(nextCount));
  } catch {
    /* Keep the session count. */
  }
  if (count < UPLOAD_NOTICE_LIMIT) notices.set(accountId, notice);
  else notices.delete(accountId);
  emit();
}
