import { useContext, useEffect, useState } from "react";
import { FCM } from "@capacitor-community/fcm";

import { PushNotifications } from "@capacitor/push-notifications";

import { PushContext } from "./PushContext";

import { useAuth0 } from "@auth0/auth0-react";
import { devicesNotificationsApi } from "ducks/devicesNotificationsApi";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";

export default function usePushNotifications(history) {
  const { user, isAuthenticated } = useAuth0();
  const nullEntry: any[] = [];
  const [notifications, setnotifications] = useState(nullEntry);
  const [token, setToken] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  //const history = useHistory();

  useEffect(() => {
    PushNotifications.checkPermissions().then((res) => {
      console.log("Push Notification check Status", res);
      if (res.receive !== "granted") {
        PushNotifications.requestPermissions().then((res) => {
          if (res.receive === "denied") {
            console.log("Push Notification permission denied");
          } else {
            console.log("Push Notification permission granted");
            register();
          }
        });
      } else {
        register();
      }
    });
  }, []);

  const register = () => {
    console.log("Initializing PushNotifications register");

    // Register with Apple / Google to receive push via APNS/FCM
    PushNotifications.register();

    // On success, we should be able to receive notifications
    PushNotifications.addListener("registration", (token) => {
      //showToast("Push registration success");
      console.log("Push registration success", token);
      setToken(token);
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener("registrationError", (error: any) => {
      console.log("Error on registration: ", JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        console.log("pushNotificationReceived");
        setnotifications((notifications) => [
          ...notifications,
          {
            id: notification.id,
            title: notification.title,
            body: notification.body,
            type: "foreground",
          },
        ]);
      }
    );

    // Method called when tapping on a notification
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        console.log("Notification Url Event", notification.notification.data);
        if (notification.notification?.data?.url) {
          const slug = notification.notification.data.url; //event.url.split("memo.wirewire.de").pop();
          console.log("Notification Url Slug", slug, history);
          if (slug) {
            history.push(slug);
          }
        }

        /* setnotifications((notifications) => [
          ...notifications,
          {
            id: notification.notification.data.id,
            title: notification.notification.data.title,
            body: notification.notification.data.body,
            type: "action",
          },
        ]); */
      }
    );
  };

  const [setDeviceToken] = devicesNotificationsApi.useSetDeviceTokenMutation();

  const getFcmToken = async () => {
    const fcm = await FCM.getToken();

    const deviceId = await Device.getId();
    console.log("fcm token generated", deviceId, fcm);
    setFcmToken(fcm);
    if (fcm.token) {
      setDeviceToken({
        values: {
          token: fcm.token,
          deviceId: deviceId.identifier,
          plattform: Capacitor.getPlatform(),
          app: import.meta.env.REACT_APP_IDENTIFIER,
        },
      });
    }
  };

  useEffect(() => {
    if (user?.sub && isAuthenticated) {
      getFcmToken();
    }
  }, [user]);

  async function handleSetDeviceToken({ user }: any) {
    if (
      user?.sub &&
      isAuthenticated &&
      Capacitor.getPlatform() === "android" &&
      token?.value
    ) {
      const deviceId = await Device.getId();
      setDeviceToken({
        values: {
          token: token.value,
          deviceId: deviceId.identifier,
          plattform: Capacitor.getPlatform(),
        },
      });
    }
  }

  useEffect(() => {
    handleSetDeviceToken({ user, token });
  }, [token, user]);

  /* const showToast = async (msg: string) => {
    alert(msg);
  }; */
  return { notifications, getFcmToken, fcmToken, register, token };
}

export function usePushContext() {
  const context = useContext(PushContext);
  return context;
}
