export const AUTH_TIMEOUT_MS = 30_000;
export const NATIVE_LOGIN_TIMEOUT_MS = 120_000;
export const AUTH_RECOVERY_KEY = "paperlesspaper.authRecovery";

export type AuthProblem = {
  kind: "connection" | "login";
  retry: "token" | "login" | "reload";
};

export function requiresLogin(error: unknown) {
  return [
    "invalid_grant",
    "missing_refresh_token",
    "login_required",
    "consent_required",
    "interaction_required",
  ].includes((error as { error?: string })?.error ?? "");
}

export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) <= 32)
  )
    return "/";
  const path = new URL(value, window.location.origin);
  if (path.origin !== window.location.origin) return "/";
  if (["/login", "/logout"].includes(path.pathname.replace(/\/$/, "")))
    return "/";
  return `${path.pathname}${path.search}${path.hash}`;
}

export function getLoginReturnTo() {
  if (window.location.pathname.replace(/\/$/, "") === "/login") {
    const pathname = new URLSearchParams(window.location.search).get(
      "pathname"
    );
    if (pathname) return safeReturnTo(pathname);
    try {
      return safeReturnTo(sessionStorage.getItem(AUTH_RECOVERY_KEY));
    } catch {
      return "/";
    }
  }
  return safeReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

// Keep this marker until a usable API token is obtained, including across redirects
// and reloads. If storage is unavailable, require a click instead of risking a loop.
export function claimAutomaticLogin(returnTo: string) {
  try {
    if (sessionStorage.getItem(AUTH_RECOVERY_KEY) !== null) return false;
    sessionStorage.setItem(AUTH_RECOVERY_KEY, returnTo);
    return true;
  } catch {
    return false;
  }
}

export function rememberLogin(returnTo: string) {
  try {
    sessionStorage.setItem(AUTH_RECOVERY_KEY, returnTo);
  } catch {
    /* optional for manual login */
  }
}

export function completeLogin() {
  try {
    sessionStorage.removeItem(AUTH_RECOVERY_KEY);
  } catch {
    /* storage can be disabled */
  }
}

export async function withAuthTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Authentication timed out")),
          AUTH_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
