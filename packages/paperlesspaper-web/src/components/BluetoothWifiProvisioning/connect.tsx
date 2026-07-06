import {
  BleClient,
  textToDataView,
  dataViewToText,
} from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import i18next from "i18next";
import * as Sentry from "@sentry/react";

const WIFI_PROVISIONING_SERVICE = "0515c086-7b0c-11ed-a1eb-0242ac120002";
const DEVICE_DATA_SERVICE = "7f74170e-7b0e-11ed-a1eb-0242ac120002";
const WIFI_SCAN_CHARACTERISTIC = "5131a3fc-7b0e-11ed-a1eb-0242ac120002";
const CONNECT_SSID_CHARACTERISTIC = "090b0ef2-7b0d-11ed-a1eb-0242ac120002";
const CONNECT_PASSWORD_CHARACTERISTIC = "a62eed84-7b0d-11ed-a1eb-0242ac120002";
const BLE_SCAN_TIMEOUT = 120000;

const normalizeDeviceName = (name?: string | null) =>
  name ? name.replace(/\s/g, "") : "";

export const useBluetoothWifiProvisioning = ({
  continueProcess,
  deviceId,
}: {
  continueProcess: any;
  deviceId: string;
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
  const [initializedBle, setInitializedBle] = useState(
    e2eMockWifiProvisioning
  );
  const [wifiNetworks, setWifinetworks] = useState(
    e2eMockWifiProvisioning
      ? [
          { ssid: "paperlesspaper-2.4", rssi: -42 },
          { ssid: "Home Network", rssi: -61 },
        ]
      : null
  );

  const isNative = Capacitor.isNativePlatform();
  const deviceRef = useRef<any>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRejectRef = useRef<((error: Error) => void) | null>(null);
  const runIdRef = useRef(0);
  const cancelledRef = useRef(false);

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

      await stopNativeScan();

      const currentDevice = deviceRef.current;
      deviceRef.current = null;

      if (resetDeviceState) {
        setDevice(null);
      }

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

  const initializeBle = async () => {
    await cleanupBluetooth({ resetDeviceState: false });

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    cancelledRef.current = false;

    setConnectionState("initizalize-ble");
    setInitializedBle(true);
    setConnectionError({});

    try {
      console.log("initializeBle");
      await BleClient.initialize();

      await BleClient.setDisplayStrings({
        scanning: `${i18next.t("Select the device")} epd-...`,
        cancel: i18next.t("Cancel"),
        availableDevices: i18next.t("Available devices"),
        noDeviceFound: i18next.t("No device found"),
      });

      if (Capacitor.getPlatform() === "android") {
        const locationEnabled = await BleClient.isLocationEnabled();
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
        if (!isRunActive(runId)) return;

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
        ).catch((error) => {
          if (!isRunActive(runId)) return;

          console.log("error reconnectBluetooth", error);
          Sentry.captureException("error reconnectBluetooth", {
            extra: { data: error },
          });
        });
      }

      if (!isRunActive(runId)) return;

      const enabled = await BleClient.isEnabled();
      if (!enabled) {
        setConnectionState("ble-enabled-error");
      }

      console.log("readWifiNetworks");
      await readWifiNetworks(deviceElement, runId);
    } catch (error) {
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
      // setConnectionState("ble-error");
    }
  };

  const writeWifiCredentials = async ({ ssid, password }) => {
    if (e2eMockWifiProvisioning) {
      continueProcess();
      return;
    }

    try {
      const currentDevice = device || deviceRef.current;

      if (!currentDevice?.deviceId) {
        throw new Error("Bluetooth device is not connected.");
      }

      console.log("write", ssid, password);
      await BleClient.write(
        currentDevice.deviceId,
        WIFI_PROVISIONING_SERVICE,
        CONNECT_SSID_CHARACTERISTIC,
        textToDataView(ssid)
      );

      await BleClient.write(
        currentDevice.deviceId,
        WIFI_PROVISIONING_SERVICE,
        CONNECT_PASSWORD_CHARACTERISTIC,
        textToDataView(password)
      );
      //setConnectionState("wifi-written");
      await cleanupBluetooth();
      continueProcess();
    } catch (error) {
      console.log("error wifi-written", error);
      setConnectionError({
        error,
        message: error.message,
        stack: error.stack,
        position: "wifi-written",
      });
      setConnectionState("ble-error");
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
    initializedBle,
    setConnectionState,
    openAppSettings,
    openLocationSettings,
    wifiNetworks,
    readWifiNetworks,
    writeWifiCredentials,
    cleanupBluetooth,
  };
};

/* TODO: function onDisconnect(deviceId) {
  console.log(`device ${deviceId} disconnected`);
}
*/
