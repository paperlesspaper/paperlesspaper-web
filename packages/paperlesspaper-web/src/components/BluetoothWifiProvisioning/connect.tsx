import {
  BleClient,
  textToDataView,
  dataViewToText,
} from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import i18next from "i18next";
import * as Sentry from "@sentry/react";
import { observeWifiAttempt } from "./wifiConnectionStatus";

const WIFI_PROVISIONING_SERVICE = "0515c086-7b0c-11ed-a1eb-0242ac120002";
const DEVICE_DATA_SERVICE = "7f74170e-7b0e-11ed-a1eb-0242ac120002";
const WIFI_SCAN_CHARACTERISTIC = "5131a3fc-7b0e-11ed-a1eb-0242ac120002";
const WIFI_CONNECTED_CHARACTERISTIC = "4c578d4c-7b0e-11ed-a1eb-0242ac120002";
const CONNECT_SSID_CHARACTERISTIC = "090b0ef2-7b0d-11ed-a1eb-0242ac120002";
const CONNECT_PASSWORD_CHARACTERISTIC = "a62eed84-7b0d-11ed-a1eb-0242ac120002";
const BLE_SCAN_TIMEOUT = 120000;

const normalizeDeviceName = (name?: string | null) =>
  name ? name.replace(/\s/g, "") : "";

export const useBluetoothWifiProvisioning = ({
  continueProcess,
  deviceId,
  beforeWriteCredentials,
}: {
  continueProcess: any;
  deviceId: string;
  beforeWriteCredentials?: () => Promise<boolean>;
}) => {
  const e2eMockWifiProvisioning =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get(
      "e2eMockWifiProvisioning"
    ) === "1";
  const [device, setDevice] = useState(null);
  const [connectionState, setConnectionState] = useState(
    e2eMockWifiProvisioning ? "wifi-networks-display" : null
  );
  const [connectionError, setConnectionError] = useState<any>({});
  const [initializedBle, setInitializedBle] = useState(e2eMockWifiProvisioning);
  const [wifiNetworks, setWifinetworks] = useState(
    e2eMockWifiProvisioning
      ? [
          { ssid: "paperlesspaper-2.4", rssi: -42 },
          { ssid: "Home Network", rssi: -61 },
        ]
      : null
  );

  const isNative = Capacitor.isNativePlatform();
  const canRequestEnable = isNative && Capacitor.getPlatform() === "android";
  const isIos = isNative && Capacitor.getPlatform() === "ios";
  const deviceRef = useRef<any>(null);
  const enabledNotificationsRef = useRef(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRejectRef = useRef<((error: Error) => void) | null>(null);
  const runIdRef = useRef(0);
  const cancelledRef = useRef(false);
  const writingRef = useRef(false);
  const observingWifiRef = useRef(false);
  const [wifiConnectionFailed, setWifiConnectionFailed] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [isRequestingEnable, setIsRequestingEnable] = useState(false);

  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  const isRunActive = (runId: number) =>
    runIdRef.current === runId && !cancelledRef.current;

  const stopNativeScan = useCallback(async () => {
    if (!isNative) return;

    try {
      await BleClient.stopLEScan();
    } catch (error) {
      console.debug("Could not stop Bluetooth LE scan", error);
    }
  }, [isNative]);

  const cleanupBluetooth = useCallback(
    async ({ resetDeviceState = true } = {}) => {
      cancelledRef.current = true;
      runIdRef.current += 1;

      const rejectPendingScan = scanRejectRef.current;
      scanRejectRef.current = null;
      rejectPendingScan?.(new Error("Bluetooth scan cancelled."));

      clearScanTimeout();

      const currentDevice = deviceRef.current;
      deviceRef.current = null;

      if (resetDeviceState) {
        setDevice(null);
        setIsRequestingEnable(false);
      }

      // Queue listener removal before another attempt can register its listener.
      if (enabledNotificationsRef.current) {
        enabledNotificationsRef.current = false;
        try {
          await BleClient.stopEnabledNotifications();
        } catch (error) {
          console.debug("Could not stop Bluetooth state notifications", error);
        }
      }

      await stopNativeScan();

      if (!currentDevice?.deviceId) return;

      try {
        await BleClient.disconnect(currentDevice.deviceId);
      } catch (error) {
        console.debug("Could not disconnect Bluetooth device", error);
      }
    },
    [clearScanTimeout, stopNativeScan]
  );

  useEffect(() => {
    return () => {
      void cleanupBluetooth({ resetDeviceState: false });
    };
  }, [cleanupBluetooth]);

  const initializeBle = async ({ requestEnable = false } = {}) => {
    const cleanup = cleanupBluetooth();
    const runId = runIdRef.current;
    await cleanup;
    if (runId !== runIdRef.current) return;
    cancelledRef.current = false;

    setConnectionState("initizalize-ble");
    setInitializedBle(true);
    setConnectionError({});
    setWifiConnectionFailed(false);
    setIsRequestingEnable(false);

    try {
      console.log("initializeBle");
      await BleClient.initialize();
      if (!isRunActive(runId)) return;

      // Web Bluetooth owns adapter availability and its user-gesture device picker.
      // Only native clients support meaningful adapter-state checks.
      if (isNative) {
        let enabled = await BleClient.isEnabled();
        if (!isRunActive(runId)) return;

        if (!enabled && requestEnable && canRequestEnable) {
          setConnectionState("ble-enabled-error");
          setIsRequestingEnable(true);
          try {
            await BleClient.requestEnable();
          } catch (error) {
            // Dismissing Android's dialog leaves the user on the retry screen.
            if (!isRunActive(runId)) return;
            setConnectionError({ error, position: "requestEnable" });
          } finally {
            if (isRunActive(runId)) setIsRequestingEnable(false);
          }
          if (!isRunActive(runId)) return;
          enabled = await BleClient.isEnabled();
          if (!isRunActive(runId)) return;
        }

        if (!enabled) {
          setConnectionState("ble-enabled-error");
          return;
        }

        enabledNotificationsRef.current = true;
        await BleClient.startEnabledNotifications((enabled) => {
          if (enabled || !isRunActive(runId)) return;
          setConnectionState("ble-enabled-error");
          // Invalidates this attempt synchronously, including reconnect callbacks.
          void cleanupBluetooth();
        });
        if (!isRunActive(runId)) return;

        // Close the gap between the initial check and subscribing to changes.
        if (!(await BleClient.isEnabled())) {
          if (!isRunActive(runId)) return;
          setConnectionState("ble-enabled-error");
          await cleanupBluetooth();
          return;
        }
        if (!isRunActive(runId)) return;
        setConnectionState("initizalize-ble");
      }

      await BleClient.setDisplayStrings({
        scanning: `${i18next.t("Select the device")} epd-...`,
        cancel: i18next.t("Cancel"),
        availableDevices: i18next.t("Available devices"),
        noDeviceFound: i18next.t("No device found"),
      });
      if (!isRunActive(runId)) return;

      if (canRequestEnable) {
        const locationEnabled = await BleClient.isLocationEnabled();
        if (!isRunActive(runId)) return;
        if (!locationEnabled) {
          setConnectionState("location-error");
          return;
        }
      }

      let deviceElement: any;

      if (isNative) {
        deviceElement = await new Promise((resolve, reject) => {
          let settled = false;

          const finish = async (foundDevice) => {
            if (settled || !isRunActive(runId)) return;

            settled = true;
            clearScanTimeout();
            scanRejectRef.current = null;
            await stopNativeScan();

            resolve(foundDevice);
          };

          const fail = (error, ignoreRunState = false) => {
            if (settled || (!ignoreRunState && !isRunActive(runId))) return;

            settled = true;
            clearScanTimeout();
            scanRejectRef.current = null;
            void stopNativeScan();
            reject(error);
          };

          scanRejectRef.current = (error) => fail(error, true);

          try {
            scanTimeoutRef.current = setTimeout(() => {
              fail(
                new Error("No scan result received within the specified time.")
              );
            }, BLE_SCAN_TIMEOUT);

            void BleClient.requestLEScan(
              {
                services: [WIFI_PROVISIONING_SERVICE],
                optionalServices: [DEVICE_DATA_SERVICE],
                allowDuplicates: true,
              },
              (result) => {
                const resultName = normalizeDeviceName(
                  result?.localName || result?.device?.name
                );
                const expectedName = normalizeDeviceName(deviceId);

                if (resultName === expectedName) {
                  void finish(result?.device);
                }
              }
            ).catch(fail);
          } catch (error) {
            fail(error);
          }
        });
      } else {
        console.log("requestDevice");
        deviceElement = await BleClient.requestDevice({
          // requestDevice
          services: [WIFI_PROVISIONING_SERVICE], //WIFI_PROVISIONING_SERVICE not working
          optionalServices: [DEVICE_DATA_SERVICE],
        });

        console.log("deviceElement", deviceElement);
      }

      if (!isRunActive(runId)) return;

      setDevice(deviceElement);
      deviceRef.current = deviceElement;

      // connect to device, the onDisconnect callback is optional

      await BleClient.connect(
        deviceElement.deviceId,
        (deviceId) => {
          if (!isRunActive(runId)) return;

          console.log("device disconnected", deviceId);
          Sentry.captureException("device disconnected from reconnect", {
            extra: { data: deviceId },
          });
          //alert("device disconnected");
          reconnectBluetooth();
          //onDisconnect(deviceId);
        },
        { timeout: 20000 }
      );

      function reconnectBluetooth() {
        if (!isRunActive(runId) || observingWifiRef.current) return;

        void BleClient.connect(
          deviceElement.deviceId,
          (deviceId: string) => {
            if (!isRunActive(runId)) return;

            console.log("device disconnected from reconnect", deviceId);
            Sentry.captureException("device disconnected from reconnect", {
              extra: { data: deviceId },
            });
            // alert("device disconnected");
            reconnectBluetooth();
            //onDisconnect(deviceId);
          },
          { timeout: 20000 }
        ).catch(async (error) => {
          if (!isRunActive(runId)) return;

          console.log("error reconnectBluetooth", error);
          Sentry.captureException("error reconnectBluetooth", {
            extra: { data: error },
          });
          const cleanupRun = runIdRef.current + 1;
          await cleanupBluetooth();
          if (cleanupRun !== runIdRef.current) return;
          setConnectionError({
            error,
            message: error.message,
            stack: error.stack,
            position: "reconnectBluetooth",
          });
          setConnectionState("ble-error");
        });
      }

      if (!isRunActive(runId)) return;

      console.log("readWifiNetworks");
      await readWifiNetworks(deviceElement, runId);
    } catch (error) {
      if (!isRunActive(runId)) return;
      clearScanTimeout();
      await stopNativeScan();

      if (!isRunActive(runId)) return;

      console.log("error initializeBle", error);
      setConnectionError({
        error,
        message: error.message,
        stack: error.stack,
        position: "initializeBle",
      });
      setConnectionState("ble-error");
    }
  };

  const retryAfterEnable = useEffectEvent(() => initializeBle());

  useEffect(() => {
    if (!isIos || connectionState !== "ble-enabled-error") return;

    let disposed = false;
    let checking = false;
    const runId = runIdRef.current;

    // iOS cannot enable the adapter from the app. Retry when the user returns
    // from Settings (or dismisses the system Bluetooth power alert).
    const listener = App.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive || disposed || checking || runId !== runIdRef.current) return;
      checking = true;
      try {
        const enabled = await BleClient.isEnabled();
        if (enabled && !disposed && runId === runIdRef.current) {
          await retryAfterEnable();
        }
      } catch (error) {
        // Keep the manual retry available if the foreground check fails.
        console.debug("Could not recheck Bluetooth after returning to the app", error);
      } finally {
        checking = false;
      }
    });
    void listener.catch((error) => {
      console.debug("Could not watch the app's foreground state", error);
    });

    return () => {
      disposed = true;
      void listener.then((handle) => handle.remove()).catch((error) => {
        console.debug("Could not remove the app state listener", error);
      });
    };
  }, [connectionState, isIos]);

  const splitWifiNetworks = (networks) => {
    const networksArray = networks.split("Â´Â´").map((n) => {
      const ssid = n.split("Â´")[0];
      const rssi = n.split("Â´")[1];
      return { ssid, rssi };
    });

    const wifiNetworksSorted = networksArray
      ? networksArray.sort((a, b) => b.rssi - a.rssi).reverse()
      : undefined;

    const wifiNetworks = wifiNetworksSorted
      ? [...new Map(wifiNetworksSorted.map((m) => [m.ssid, m])).values()].sort(
          (a: any, b: any) => b.rssi - a.rssi
        )
      : wifiNetworksSorted;

    const wifiNetworksFiltered = wifiNetworks
      ? [...wifiNetworks].filter((e) => e.ssid !== "")
      : undefined;

    if (wifiNetworksFiltered.length === 0) {
      setConnectionState("wifi-networks-not-found");
    }

    return wifiNetworksFiltered;
  };

  const firstTry = async (device, counter, runId?: number) => {
    if (runId && !isRunActive(runId)) return false;

    try {
      await BleClient.read(
        device.deviceId,
        DEVICE_DATA_SERVICE,
        WIFI_SCAN_CHARACTERISTIC
      );

      return true;
    } catch (error) {
      if (runId && !isRunActive(runId)) return false;

      console.log("first read", error);
      if (counter > 5) {
        setConnectionState("ble-error");
        setConnectionError({
          error,
          message: error.message,
          stack: error.stack,
          position: "firstTry",
        });
        return false;
      } else {
        await new Promise((r) => setTimeout(r, 5000));
        const count = counter + 1;
        return firstTry(device, count, runId);
      }
    }
  };

  const readWifiNetworks = async (device, runId?: number) => {
    const canRead = await firstTry(device, 0, runId);

    if (canRead === false || (runId && !isRunActive(runId))) return;

    try {
      setConnectionState("wifi-networks-loading");

      console.log("start reading", device);

      const scanWifi = await BleClient.read(
        device.deviceId,
        DEVICE_DATA_SERVICE,
        WIFI_SCAN_CHARACTERISTIC
      );
      if (runId && !isRunActive(runId)) return;

      console.log(
        "wifi scan results level",
        scanWifi,
        splitWifiNetworks(dataViewToText(scanWifi)),
        dataViewToText(scanWifi)
      );

      if (runId && !isRunActive(runId)) return;

      setWifinetworks(splitWifiNetworks(dataViewToText(scanWifi)));
      setConnectionState("wifi-networks-display");
    } catch (error) {
      if (runId && !isRunActive(runId)) return;

      console.log("error wifi-networks-display", error);
      setConnectionError({
        error,
        message: error.message,
        stack: error.stack,
        position: "wifi-networks-loading",
      });
      setConnectionState("ble-error");
    }
  };

  const writeWifiCredentials = async ({ ssid, password }) => {
    if (writingRef.current) return;
    writingRef.current = true;
    setIsWriting(true);
    setWifiConnectionFailed(false);
    const writeRun = runIdRef.current;
    try {
      // Registration must be pending before firmware sends its BLE proof.
      // Ordinary Wi-Fi changes omit this callback and never start a claim/reset.
      if (beforeWriteCredentials && !(await beforeWriteCredentials())) return;
      if (writeRun !== runIdRef.current) return;
      if (e2eMockWifiProvisioning) {
        continueProcess();
        return;
      }
      const currentDevice = device || deviceRef.current;

      if (!currentDevice?.deviceId) {
        throw new Error("Bluetooth device is not connected.");
      }

      observingWifiRef.current = true;
      await BleClient.write(
        currentDevice.deviceId,
        WIFI_PROVISIONING_SERVICE,
        CONNECT_SSID_CHARACTERISTIC,
        textToDataView(ssid)
      );

      if (writeRun !== runIdRef.current) return;

      await BleClient.write(
        currentDevice.deviceId,
        WIFI_PROVISIONING_SERVICE,
        CONNECT_PASSWORD_CHARACTERISTIC,
        textToDataView(password)
      );
      if (writeRun !== runIdRef.current) return;
      const outcome = await observeWifiAttempt(
        () => BleClient.read(
          currentDevice.deviceId,
          DEVICE_DATA_SERVICE,
          WIFI_CONNECTED_CHARACTERISTIC,
          { timeout: 5000 }
        ),
        () => isRunActive(writeRun)
      );
      if (outcome === "cancelled" || !isRunActive(writeRun)) return;
      if (outcome === "failed") {
        setWifiConnectionFailed(true);
        setConnectionState("wifi-networks-password");
        return;
      }
      // Only credentials have been sent. Cloud verification still determines
      // activation success; BLE status 1 is not proof of a connection.
      const cleanupRun = runIdRef.current + 1;
      await cleanupBluetooth();
      if (cleanupRun !== runIdRef.current) return;
      continueProcess();
    } catch (error) {
      if (writeRun !== runIdRef.current) return;
      console.log("error wifi-written", error);
      setConnectionError({
        error,
        message: error.message,
        stack: error.stack,
        position: "wifi-written",
      });
      setConnectionState("ble-error");
    } finally {
      observingWifiRef.current = false;
      writingRef.current = false;
      setIsWriting(false);
    }
  };

  const openAppSettings = async () => {
    await BleClient.openAppSettings();
  };

  const openLocationSettings = async () => {
    await BleClient.openLocationSettings();
  };

  // disconnect after 10 sec
  /*setTimeout(async () => {
    await BleClient.disconnect(device.deviceId);
    console.log("disconnected from device", device);
  }, 10000);*/

  return {
    BleClient,
    connectionState,
    connectionError,
    initializeBle,
    requestEnable: () => initializeBle({ requestEnable: true }),
    canRequestEnable,
    isIos,
    isRequestingEnable,
    initializedBle,
    setConnectionState,
    openAppSettings,
    openLocationSettings,
    wifiNetworks,
    readWifiNetworks,
    writeWifiCredentials,
    isWriting,
    wifiConnectionFailed,
    cleanupBluetooth,
    debugInfo: {
      requestedDeviceId: deviceId,
      connectedDevice: device,
      isNative,
      e2eMockWifiProvisioning,
      activeRunId: runIdRef.current,
      cancelled: cancelledRef.current,
      nativeScanPending: scanRejectRef.current !== null,
      scanTimeoutActive: scanTimeoutRef.current !== null,
      services: {
        wifiProvisioning: WIFI_PROVISIONING_SERVICE,
        deviceData: DEVICE_DATA_SERVICE,
      },
      characteristics: {
        wifiScan: WIFI_SCAN_CHARACTERISTIC,
        connectSsid: CONNECT_SSID_CHARACTERISTIC,
        connectPassword: CONNECT_PASSWORD_CHARACTERISTIC,
      },
      scanTimeoutMs: BLE_SCAN_TIMEOUT,
    },
  };
};

/* TODO: function onDisconnect(deviceId) {
  console.log(`device ${deviceId} disconnected`);
}
*/
