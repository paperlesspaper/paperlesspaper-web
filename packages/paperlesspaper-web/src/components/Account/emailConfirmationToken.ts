let capturedToken = "";

// Loaded before telemetry is initialized: never expose the mailbox-verification
// secret to navigation tracing. Keep it only in memory for this page.
export function readEmailConfirmationToken() {
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/confirm-email"
  ) {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "token"
    );
    if (token) {
      capturedToken = token;
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname
      );
    }
  }
  return capturedToken;
}

export function clearEmailConfirmationToken() {
  capturedToken = "";
}

readEmailConfirmationToken();
