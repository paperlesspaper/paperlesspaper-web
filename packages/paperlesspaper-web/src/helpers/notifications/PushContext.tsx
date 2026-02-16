import React, { createContext } from "react";
import usePushNotifications from "./usePush";
import usePushNotificationsPwa from "./usePushPwa";

export const PushContext: any = createContext("Default Value");

export default function NotificationsProvider({ children, history }: any) {
  const pushNotifcations = usePushNotifications(history);

  return (
    <PushContext.Provider value={pushNotifcations}>
      {children}
    </PushContext.Provider>
  );
}

export function NotificationsProviderWeb({ children }: any) {
  const pushNotifcations = usePushNotificationsPwa();

  return (
    <PushContext.Provider value={pushNotifcations}>
      {children}
    </PushContext.Provider>
  );
}
