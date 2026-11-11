import { PushNotifications } from "@capacitor/push-notifications";
import { FCM } from "@capacitor-community/fcm";
import type { PluginListenerHandle } from "@capacitor/core";
import type { PushAdapter } from "./pushSubscription";

export const nativePush: PushAdapter = {
  supported: () => true,
  permission: async () =>
    (await PushNotifications.checkPermissions()).receive === "granted",
  requestPermission: async () =>
    (await PushNotifications.requestPermissions()).receive === "granted",
  register: async () => {
    // Auto-init stays off: registration is always controlled by the account opt-in.
    await FCM.setAutoInit({ enabled: false });
    const listeners: PluginListenerHandle[] = [];
    let timer: ReturnType<typeof setTimeout>;
    try {
      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Push registration timed out")),
          20000,
        );
        void (async () => {
          listeners.push(
            await PushNotifications.addListener("registration", () =>
              resolve(),
            ),
          );
          listeners.push(
            await PushNotifications.addListener("registrationError", reject),
          );
          await PushNotifications.register();
        })().catch(reject);
      });
      return (await FCM.getToken()).token;
    } finally {
      clearTimeout(timer);
      await Promise.all(listeners.map((listener) => listener.remove()));
    }
  },
  unregister: async () => {
    await FCM.setAutoInit({ enabled: false });
    const results = await Promise.allSettled([
      PushNotifications.unregister(),
      FCM.deleteInstance(),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("Could not unregister native push");
    }
  },
};
