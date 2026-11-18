// Loaded only after an explicit push opt-in and granted permission.
import { deleteApp, getApps, initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDHjV4zFIWWqllsPHV4p2s5q10MxvyCt6w",
  authDomain: "memo-2e24c.firebaseapp.com",
  projectId: "memo-2e24c",
  storageBucket: "memo-2e24c.appspot.com",
  messagingSenderId: "536456473474",
  appId: "1:536456473474:web:ceac0d6adf993a18c5bd9b",
  measurementId: "G-HF46RPMFGX",
};

let messaging: Messaging | undefined;
let pushApp: FirebaseApp | undefined;
let registered = false;

export async function registerWebPush() {
  if (Notification.permission !== "granted" || !(await isSupported())) {
    throw new Error("Push notifications are unavailable");
  }
  pushApp ??=
    getApps().find((app) => app.name === "paperlesspaper-push") ??
    initializeApp(firebaseConfig, "paperlesspaper-push");
  messaging ??= getMessaging(pushApp);
  const token = await getToken(messaging, {
    vapidKey:
      "BA2pkHdh1jbYH61wx5hpcgM6lF-yXmYOO9iPXAlZEoAXGorNldnhMaJCs3otD7UoVJs9iyAbVyU3RbeFxHByTgI",
  });
  registered = Boolean(token);
  return token;
}

export async function unregisterWebPush() {
  try {
    // deleteToken can register a service worker itself when getToken failed.
    // Never call it unless this instance actually acquired a token.
    if (messaging && registered) await deleteToken(messaging);
  } finally {
    // Discard the cached service-worker registration before re-enabling push.
    if (pushApp) await deleteApp(pushApp);
    pushApp = undefined;
    messaging = undefined;
    registered = false;
  }
}
