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
  apiKey: "AIzaSyBSQA0-DriC_g_G6XKrZYDOQleEFhZzCrQ",
  authDomain: "wirewire-c5529.firebaseapp.com",
  projectId: "wirewire-c5529",
  storageBucket: "wirewire-c5529.firebasestorage.app",
  messagingSenderId: "370688258529",
  appId: "1:370688258529:web:9e22afaa12adf2a1d1a2a0",
  measurementId: "G-7N52WJSD3W",
};

const vapidKey =
  "BAXSLLaHjJkPDZnFxFx72CcqLehcZu0MITxIg4SmD7MXHxCDKzK27J5Hp6u-Vrsh5zFRNKECk-1Ut1xlFrPyLkk";

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
  // Browsers keep the subscription from the previous Firebase project on this scope.
  const scope = new URL("/firebase-cloud-messaging-push-scope", location.origin);
  const worker = await navigator.serviceWorker?.getRegistration(scope.href);
  if (worker?.scope === scope.href) {
    const subscription = await worker.pushManager.getSubscription();
    const key = subscription?.options.applicationServerKey;
    if (key) {
      const currentKey = btoa(String.fromCharCode(...new Uint8Array(key)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      if (currentKey !== vapidKey) await subscription.unsubscribe();
    }
  }
  const token = await getToken(messaging, { vapidKey });
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
