export const STORAGE_LIMIT_MESSAGE =
  "Organization storage limit reached (500 MB). Delete pictures or replace them with smaller images.";

export function isStorageLimitError(error: any): boolean {
  return (
    error?.status === 413 && error?.data?.message === STORAGE_LIMIT_MESSAGE
  );
}
