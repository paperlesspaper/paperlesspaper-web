import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { devicesNotificationsApi } from "ducks/devicesNotificationsApi";
import useAccount from "helpers/useAccount";
import {
  hasPushOptIn,
  PUSH_OPT_IN_KEY,
  serializePush,
} from "./pushSubscription";
import type { PushAdapter } from "./pushSubscription";

export default function usePushSettings(adapter: PushAdapter) {
  const { user, reduxToken } = useAccount();
  const userId = user?.sub;
  const authenticated = Boolean(userId && reduxToken);
  const [revision, setRevision] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<
    "permission" | "registration" | "cleanup" | null
  >(null);
  const [setDeviceToken] = devicesNotificationsApi.useSetDeviceTokenMutation();
  const [removeDeviceToken] =
    devicesNotificationsApi.useRemoveDeviceTokenMutation();
  const context = useRef({ userId, authenticated, generation: 0 });
  context.current.userId = userId;
  context.current.authenticated = authenticated;
  const running = useRef(false);
  const supported = adapter.supported();

  const removeBackendToken = async () => {
    const device = await Device.getId();
    await removeDeviceToken({
      values: {
        deviceId: device.identifier,
        plattform: Capacitor.getPlatform(),
      },
    }).unwrap();
  };

  const saveToken = async (token: string) => {
    if (!token) throw new Error("Missing push token");
    const device = await Device.getId();
    await setDeviceToken({
      values: {
        token,
        deviceId: device.identifier,
        plattform: Capacitor.getPlatform(),
        app: import.meta.env.REACT_APP_IDENTIFIER,
      },
    }).unwrap();
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PUSH_OPT_IN_KEY || event.key === null) {
        context.current.generation++;
        setRevision((value) => value + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const generation = ++context.current.generation;
    const current = () =>
      context.current.generation === generation &&
      context.current.userId === userId &&
      context.current.authenticated === authenticated;
    setEnabled(false);
    setError(null);
    setBusy(true);
    running.current = true;
    void serializePush(async () => {
      if (!current()) return;
      // Authentication may still be loading on a returning user's first render.
      if (!authenticated && localStorage.getItem(PUSH_OPT_IN_KEY)) return;
      if (
        authenticated &&
        supported &&
        hasPushOptIn(userId) &&
        (await adapter.permission())
      ) {
        if (!current()) return;
        const token = await adapter.register();
        if (!current()) {
          await adapter.unregister();
          return;
        }
        await saveToken(token);
        if (current()) setEnabled(true);
      } else {
        // Retire registrations from versions that subscribed automatically.
        // Keep a saved opt-in while authentication is still loading.
        if (authenticated) localStorage.removeItem(PUSH_OPT_IN_KEY);
        await adapter.unregister();
        if (authenticated && current()) await removeBackendToken();
      }
    })
      .catch(() => {
        if (current())
          setError(hasPushOptIn(userId) ? "registration" : "cleanup");
      })
      .finally(() => {
        if (current()) {
          running.current = false;
          setBusy(false);
        }
      });
    return () => {
      context.current.generation++;
    };
    // Auth token refreshes must not restart push registration.
  }, [userId, authenticated, adapter, supported, revision]);

  const enableNotifications = async () => {
    if (running.current || !authenticated || !supported) return;
    running.current = true;
    setBusy(true);
    setError(null);
    const generation = context.current.generation;
    const current = () =>
      context.current.generation === generation &&
      context.current.userId === userId &&
      context.current.authenticated;
    try {
      // Invoke synchronously, while the browser still has user activation.
      const granted = await adapter.requestPermission();
      if (!current()) return;
      if (!granted) {
        setError("permission");
        return;
      }
      await serializePush(async () => {
        if (!current()) return;
        try {
          const token = await adapter.register();
          if (!current()) return;
          await saveToken(token);
          if (!current()) return;
          localStorage.setItem(PUSH_OPT_IN_KEY, userId);
          setEnabled(true);
        } finally {
          if (!current() || !hasPushOptIn(userId)) {
            await adapter.unregister();
            if (current()) await removeBackendToken();
          }
        }
      });
    } catch {
      if (current()) setError("registration");
    } finally {
      if (current()) {
        running.current = false;
        setBusy(false);
      }
    }
  };

  const disableNotifications = async () => {
    if (running.current || !authenticated) return;
    running.current = true;
    setBusy(true);
    setError(null);
    const generation = context.current.generation;
    const current = () =>
      context.current.generation === generation &&
      context.current.userId === userId;
    try {
      // Stop future restores even if offline cleanup needs to be retried.
      localStorage.removeItem(PUSH_OPT_IN_KEY);
      setEnabled(false);
      await serializePush(async () => {
        if (!current()) return;
        // Attempt both cleanups even if one fails.
        const results = await Promise.allSettled([
          adapter.unregister(),
          removeBackendToken(),
        ]);
        if (results.some((result) => result.status === "rejected"))
          throw new Error("Push cleanup failed");
      });
    } catch {
      if (current()) setError("cleanup");
    } finally {
      if (current()) {
        running.current = false;
        setBusy(false);
      }
    }
  };

  return {
    enabled,
    optedIn: hasPushOptIn(userId),
    busy,
    supported,
    error,
    enableNotifications,
    disableNotifications,
  };
}
