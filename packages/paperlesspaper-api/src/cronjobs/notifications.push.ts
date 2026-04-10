import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import * as Sentry from "@sentry/node";
import { accountsService, config, sendEmail } from "@internetderdinge/api";

// Import types in separate import type statements
import type {
  MessagingPayload,
  MessagingOptions,
} from "firebase-admin/messaging";

const firebaseServiceAccountFile = path.resolve(
  process.cwd(),
  "memo-2e24c-firebase-adminsdk-tjkbf-68c91d96da.json",
);

const getFirebaseServiceAccount = (): admin.ServiceAccount | null => {
  const serviceAccountJson = process.env.FIREBASE_ADMINSDK_JSON?.trim();

  if (serviceAccountJson) {
    try {
      return JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    } catch (error) {
      throw new Error("FIREBASE_ADMINSDK_JSON is not valid JSON", {
        cause: error,
      });
    }
  }

  if (!fs.existsSync(firebaseServiceAccountFile)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(firebaseServiceAccountFile, "utf8"),
    ) as admin.ServiceAccount;
  } catch (error) {
    throw new Error("Firebase service account file is not valid JSON", {
      cause: error,
    });
  }
};

const firebaseServiceAccount = getFirebaseServiceAccount();

if (firebaseServiceAccount && admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseServiceAccount),
  });
}

const getFirebaseMessaging = () => {
  if (admin.apps.length === 0) {
    throw new Error(
      "Firebase Admin SDK is not configured. Set FIREBASE_ADMINSDK_JSON or mount the service account JSON file.",
    );
  }

  return getMessaging();
};

export const sendPushNotification = async ({
  title = "Unnamed notification",
  body = "Unnamed notification",
  deviceNotifications,
  kind,
  user,
  image,
  url = "",
  lng,
  auth0accountPreload,
  urgent,
}: {
  title?: string;
  body?: string;
  deviceNotifications: {
    tokens: { token: string }[];
    settings?: Record<string, { push?: boolean; email?: boolean }>;
    user: string;
    bounceEmail?: string;
  };
  kind: string;
  user: string;
  image?: string;
  url?: string;
  lng?: string;
  auth0accountPreload?: any;
  urgent: boolean;
}) => {
  if (
    config.env !== "production" &&
    user !== "614fb1d709dd9f6de85d6374" &&
    kind !== "test"
  ) {
    console.log("notification not sent", title, body);
    return { environment: config.env, user, error: "notification not sent" };
  } else if (config.env !== "production") {
    console.log("notification sent to developers", title, body);
  }

  const payload: MessagingPayload = {
    notification: {
      title,
      body: config.env === "production" ? body : `${body} - ${config.env}`,
    },
    android: {
      notification: {
        sound: "default",
      },
    },
    apns: {
      headers: {
        "apns-priority": urgent ? "10" : "5",
      },
      payload: {
        aps: {
          sound: "default",
          ...(urgent ? { "interruption-level": "time-sensitive" } : {}),
        },
      },
    },
    data: {
      url,
    },
  };

  const options: MessagingOptions = {
    priority: "high",
    timeToLive: 60 * 60 * 24,
  };

  const response: any[] = [];

  if (!deviceNotifications || deviceNotifications.tokens.length === 0) {
    return { message: "no devices found" };
  }

  const settingsKind = deviceNotifications.settings
    ? deviceNotifications.settings[
        kind === "offline" || kind === "battery" ? "battery" : kind
      ]
    : undefined;

  const shouldSendPush = kind === "test" || settingsKind?.push === true;

  const messaging = shouldSendPush ? getFirebaseMessaging() : null;

  await Promise.all(
    deviceNotifications.tokens.map(async (device) => {
      if (device && shouldSendPush && device.token) {
        try {
          const responseContent = await messaging!.send({
            ...payload,
            token: device.token,
          });
          console.log("try sending a message", responseContent);
          response.push(responseContent);
        } catch (error) {
          console.log("error while sending a message");
        }
      }
    }),
  );

  if (kind === "test" || settingsKind?.email === true) {
    const auth0account = auth0accountPreload
      ? auth0accountPreload
      : await accountsService.getAccountById(deviceNotifications.user);
    if (deviceNotifications.bounceEmail !== auth0account.data.email) {
      const responseContent = await sendEmail({
        title,
        body,
        email: auth0account.data.email,
        image,
        url,
        lng,
      });
      console.log("try sending an email", auth0account.data.email);
      response.push(responseContent);
    } else {
      console.log("email not sent because of bounce", auth0account.data.email);
      Sentry.captureException(
        "email not sent because of bounce",
        auth0account.data.email,
      );
    }
  }

  console.log("send");
  return response;
};

export default {
  sendPushNotification,
};
