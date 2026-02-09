import { useContext, useEffect, useState } from "react";

import { PushContext } from "./PushContext";

import { devicesNotificationsApi } from "ducks/devicesNotificationsApi";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import firebase, {
  // getTokenFirebase,
  firebaseApp,
  messaging,
} from "helpers/firebase";
import { getToken } from "firebase/messaging";

import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import useAccount from "helpers/useAccount";

export default function usePushNotificationsPwa() {
  const { user, reduxToken } = useAccount();
  const nullEntry: any[] = [];
  const [notifications] = useState(nullEntry);
  const [token] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  const [messagingState, setMessaging] = useState<any>(null);

  const getTokenFirebase = () => {
    return getToken(messagingState, {
      vapidKey:
        "BA2pkHdh1jbYH61wx5hpcgM6lF-yXmYOO9iPXAlZEoAXGorNldnhMaJCs3otD7UoVJs9iyAbVyU3RbeFxHByTgI",
    })
      .then((currentToken) => {
        if (currentToken) {
          return currentToken;
          console.log("current token for client: ", currentToken);
        } else {
          console.log(
            "No registration token available. Request permission to generate one."
          );
        }
      })
      .catch((err) => {
        console.log("An error occurred while retrieving token. ", err);
      });
  };

  useEffect(() => {
    const app = firebaseApp();

    if ("serviceWorker" in navigator) {
      setMessaging(messaging(app));
    }
  }, []);

  const [setDeviceToken] = devicesNotificationsApi.useSetDeviceTokenMutation();

  const getFcmToken = async () => {
    const token = await getTokenFirebase();
    const deviceId = await Device.getId();

    setFcmToken(token);
    if (token)
      setDeviceToken({
        values: {
          token: token,
          deviceId: deviceId.identifier,
          plattform: Capacitor.getPlatform(),
        },
      });
  };

  useEffect(() => {
    if (user?.sub && reduxToken) {
      getFcmToken();
    }
  }, [user, reduxToken]);

  return { notifications, getFcmToken, fcmToken, token };
}

export function usePushContext() {
  const context = useContext(PushContext);
  return context;
}
