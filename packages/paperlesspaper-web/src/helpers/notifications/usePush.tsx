import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import usePushSettings from "./usePushSettings";
import { nativePush } from "./nativePush";

export default function usePushNotifications(history) {
  const settings = usePushSettings(nativePush);
  useEffect(() => {
    if (!settings.enabled) return;
    const listener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event) => {
        const url = event.notification?.data?.url;
        if (url) history.push(url);
      },
    );
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [settings.enabled, history]);
  return settings;
}
