import type { PushAdapter } from "./pushSubscription";

let firebase: typeof import("../firebase") | undefined;

export const webPush: PushAdapter = {
  supported: () =>
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window,
  permission: async () =>
    "Notification" in window && Notification.permission === "granted",
  requestPermission: async () => {
    // Keep this call in the click handler's user activation, before any imports.
    return (await Notification.requestPermission()) === "granted";
  },
  register: async () => {
    firebase ??= await import("../firebase");
    return firebase.registerWebPush();
  },
  unregister: async () => {
    try {
      if (firebase) await firebase.unregisterWebPush();
    } finally {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const workers = [
            registration.active,
            registration.waiting,
            registration.installing,
          ];
          if (
            !workers.some(
              (worker) =>
                worker &&
                new URL(worker.scriptURL).pathname ===
                  "/firebase-messaging-sw.js",
            )
          )
            continue;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) await subscription.unsubscribe();
          await registration.unregister();
        }
      }
    }
  },
};
