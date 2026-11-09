/** Installed only for layout renders. Bridges legacy integrations' DOM readiness markers.
 * It contains no closure dependencies because Puppeteer serializes this function.
 */
export function installEmbeddedRenderBridge(): void {
  if (window.parent === window || !window.name.startsWith("paperless-slot:"))
    return;
  let context: { renderId: string; regionId: string; parentOrigin: string };
  try {
    context = JSON.parse(window.name.slice("paperless-slot:".length));
  } catch {
    return;
  }
  let initialized = false;
  let completed = false;
  const notify = () => {
    if (!initialized || completed) return;
    const status = document.documentElement?.dataset.paperlessRenderStatus;
    if (!document.querySelector("#website-has-loaded") && status !== "error")
      return;
    completed = true;
    window.parent.postMessage(
      {
        ...context,
        type: "PAPERLESS_RENDER_STATUS",
        status: status === "error" ? "error" : "ready",
        processing: document
          .querySelector('meta[name="paperless:epd-optimize"]')
          ?.getAttribute("content"),
      },
      context.parentOrigin
    );
  };
  window.addEventListener(
    "message",
    (event) => {
      if (
        event.source !== window.parent ||
        event.origin !== context.parentOrigin ||
        event.data?.type !== "INIT" ||
        event.data.renderId !== context.renderId ||
        event.data.regionId !== context.regionId ||
        initialized
      )
        return;
      initialized = true;
      document.querySelector("#website-has-loaded")?.remove();
      document.documentElement.dataset.paperlessRenderStatus = "loading";
      // Older GoogleCalendar expects the separate GOOGLECALENDAR message.
      const calendar = event.data.data?.calendarData;
      if (event.data.data?.kind === "google-calendar" && calendar)
        queueMicrotask(() =>
          window.postMessage(
            { cmd: "message", type: "GOOGLECALENDAR", data: calendar.events },
            location.origin
          )
        );
    },
    true
  );
  document.addEventListener("DOMContentLoaded", () => {
    new MutationObserver(notify).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  window.addEventListener(
    "load",
    () => {
      window.parent.postMessage(
        { ...context, type: "PAPERLESS_RENDER_HELLO" },
        context.parentOrigin
      );
    },
    { once: true }
  );
}
