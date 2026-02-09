import {
  BleClient,
  textToDataView,
  dataViewToText,
} from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import i18next from "i18next";
import * as Sentry from "@sentry/react";

const WIFI_PROVISIONING_SERVICE = "0515c086-7b0c-11ed-a1eb-0242ac120002";
const DEVICE_DATA_SERVICE = "7f74170e-7b0e-11ed-a1eb-0242ac120002";
const WIFI_SCAN_CHARACTERISTIC = "5131a3fc-7b0e-11ed-a1eb-0242ac120002";
const CONNECT_SSID_CHARACTERISTIC = "090b0ef2-7b0d-11ed-a1eb-0242ac120002";
const CONNECT_PASSWORD_CHARACTERISTIC = "a62eed84-7b0d-11ed-a1eb-0242ac120002";

export const useBluetoothWifiProvisioning = ({
  continueProcess,
  deviceId,
}: {
  continueProcess: any;
  deviceId: string;
}) => {
  const [device, setDevice] = useState(null);
  const [connectionState, setConnectionState] = useState(null);
  const [connectionError, setConnectionError] = useState<any>({});
  const [initializedBle, setInitializedBle] = useState(false);
  const [wifiNetworks, setWifinetworks] = useState(null);

  const isNative = Capacitor.isNativePlatform();

  let deviceElement: any;
  const initializeBle = async () => {
    setConnectionState("initizalize-ble");
    setInitializedBle(true);

    try {
      console.log("initializeBle");
      await BleClient.initialize({ androidNeverForLocation: true });

      await BleClient.setDisplayStrings({
        scanning: `${i18next.t("Select the device")} epd-...`,
        cancel: i18next.t("Cancel"),
        availableDevices: i18next.t("Available devices"),
        noDeviceFound: i18next.t("No device found"),
      });

      if (isNative) {
        deviceElement = await new Promise((resolve, reject) => {
          try {
            BleClient.requestLEScan(
              {
                services: [WIFI_PROVISIONING_SERVICE],
                optionalServices: [DEVICE_DATA_SERVICE],
              },
              (result) => {
                if (result?.device?.name === deviceId) resolve(result?.device);
              }
            );

            setTimeout(() => {
              reject(
                new Error("No scan result received within the specified time.")
              );
              setConnectionState("ble-error");
              setConnectionError({
                error: new Error(
                  "No scan result received within the specified time."
                ),
                message: "No scan result received within the specified time.",
                stack: "",
                position: "initializeBle",
              });
            }, 120000);
          } catch (error) {
            reject(error);
            setConnectionState("ble-error");
            setConnectionError({
              error,
              message: error.message,
              stack: error.stack,
              position: "initializeBle catch",
            });
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

      setDevice(deviceElement);

      // connect to device, the onDisconnect callback is optional

      await BleClient.connect(
        deviceElement.deviceId,
        (deviceId) => {
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
        BleClient.connect(
          deviceElement.deviceId,
          (deviceId: string) => {
            console.log("device disconnected from reconnect", deviceId);
            Sentry.captureException("device disconnected from reconnect", {
              extra: { data: deviceId },
            });
            // alert("device disconnected");
            reconnectBluetooth();
            //onDisconnect(deviceId);
          },
          { timeout: 20000 }
        );
      }

      const enabled = await BleClient.isEnabled();
      if (!enabled) {
        setConnectionState("ble-enabled-error");
      }

      if (Capacitor.getPlatform() === "android") {
        const locationEnabled = await BleClient.isLocationEnabled();
        if (!locationEnabled) {
          setConnectionState("location-error");
        }
      }
      console.log("readWifiNetworks");
      await readWifiNetworks(deviceElement);
    } catch (error) {
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

  const firstTry = async (device, counter) => {
    try {
      await BleClient.read(
        device.deviceId,
        DEVICE_DATA_SERVICE,
        WIFI_SCAN_CHARACTERISTIC
      );

      return true;
    } catch (error) {
      console.log("first read", error);
      if (counter > 5) {
        setConnectionState("ble-error");
        setConnectionError({
          error,
          message: error.message,
          stack: error.stack,
          position: "firstTry",
        });
      } else {
        await new Promise((r) => setTimeout(r, 5000));
        const count = counter + 1;
        await firstTry(device, count);
      }
    }
  };

  const readWifiNetworks = async (device) => {
    await firstTry(device, 0);

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
      setWifinetworks(splitWifiNetworks(dataViewToText(scanWifi)));
      setConnectionState("wifi-networks-display");
    } catch (error) {
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
    try {
      console.log("write", ssid, password);
      await BleClient.write(
        device.deviceId,
        WIFI_PROVISIONING_SERVICE,
        CONNECT_SSID_CHARACTERISTIC,
        textToDataView(ssid)
      );

      await BleClient.write(
        device.deviceId,
        WIFI_PROVISIONING_SERVICE,
        CONNECT_PASSWORD_CHARACTERISTIC,
        textToDataView(password)
      );
      //setConnectionState("wifi-written");
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
  };
};

/* TODO: function onDisconnect(deviceId) {
  console.log(`device ${deviceId} disconnected`);
}
*/
