import React, { createContext } from "react";
import usePushNotifications from "./usePush";
import usePushNotificationsPwa from "./usePushPwa";
import { useUpdateCurrentLanguageFromFrontend } from "helpers/useUpdateCurrentLanguageFromFrontend";

export const PushContext: any = createContext("Default Value");

export default function NotificationsProvider({ children, history }: any) {
  const pushNotifcations = usePushNotifications(history);
  const updateCurrentLanguageFromFrontend =
    useUpdateCurrentLanguageFromFrontend();

  return (
    <PushContext.Provider value={pushNotifcations}>
      {children}
    </PushContext.Provider>
  );
}

export function NotificationsProviderWeb({ children }: any) {
  const pushNotifcations = usePushNotificationsPwa();
  const updateCurrentLanguageFromFrontend =
    useUpdateCurrentLanguageFromFrontend();

  return (
    <PushContext.Provider value={pushNotifcations}>
      {children}
    </PushContext.Provider>
  );
}
