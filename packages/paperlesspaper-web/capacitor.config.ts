import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: process.env.REACT_APP_IDENTIFIER_IOS,
  appName: process.env.APP_NAME,
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    path: "android",
  },

  ios: {
    includePlugins: [
      "@capacitor-community/bluetooth-le",
      "@capgo/capacitor-social-login",
      "@capgo/capacitor-share-target",
      "@capacitor-community/fcm",
      "@capacitor/app",
      "@capacitor/browser",
      "@capacitor/device",
      "@capacitor/keyboard",
      "@capacitor/push-notifications",
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
    ],
  },
  server: {
    cleartext: true,
  },
  hooks: {
    "capacitor:sync:after": "node ./scripts/update_ios_deployment.cjs",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    CapacitorShareTarget: {
      appGroupId: `de.wirewire.wirewire.shareextension`, // ${process.env.REACT_APP_SHARE_TARGET_APP_GROUP_ID}
    },
    SplashScreen: {
      backgroundColor: "#0076FF",
      androidScaleType: "CENTER_CROP",
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    BluetoothLe: {
      displayStrings: {
        scanning: "Wähle das Gerät epd-...",
        cancel: "Abbrechen",
        availableDevices: "Verfügbare Geräte",
        noDeviceFound: "Kein Gerät gefunden",
      },
    },
    /*  GoogleAuth: {
      iosClientId:
        "719541140462-gshck1gf8o1s8gqiuu9pnmkjm40prh3g.apps.googleusercontent.com",
      scopes: ["profile", "email"],
      // serverClientId: "xxxxxx-xxxxxxxxxxxxxxxxxx.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    }, */
  },
};

export default config;
