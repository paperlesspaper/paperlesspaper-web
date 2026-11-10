export const PUSH_OPT_IN_KEY = "paperlesspaper.push-opt-in.v1";

export type PushAdapter = {
  supported: () => boolean;
  permission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  register: () => Promise<string>;
  // Must not create a Firebase instance or request a new token.
  unregister: () => Promise<void>;
};

export function hasPushOptIn(userId?: string) {
  return Boolean(userId && localStorage.getItem(PUSH_OPT_IN_KEY) === userId);
}

// Serialize registration and cleanup across remounts and account changes.
let pending: Promise<unknown> = Promise.resolve();
export function serializePush<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.catch(() => undefined);
  return result;
}
