import React, { createContext, useContext } from "react";
import usePushNotifications from "./usePush";
import usePushNotificationsPwa from "./usePushPwa";
import type usePushSettings from "./usePushSettings";

export const PushContext = createContext<ReturnType<
  typeof usePushSettings
> | null>(null);

export function usePushContext() {
  const context = useContext(PushContext);
  if (!context)
    throw new Error("Push settings require a NotificationsProvider");
  return context;
}

export default function NotificationsProvider({ children, history }: any) {
  const notifications = usePushNotifications(history);
  return (
    <PushContext.Provider value={notifications}>
      {children}
    </PushContext.Provider>
  );
}

export function NotificationsProviderWeb({ children }: any) {
  const notifications = usePushNotificationsPwa();
  return (
    <PushContext.Provider value={notifications}>
      {children}
    </PushContext.Provider>
  );
}
