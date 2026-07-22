import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button, TextInput, PasswordInput } from "@progressiveui/react";
import { useBluetoothWifiProvisioning } from "./connect";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./styles.module.scss";

import {
  faWifi,
  faWifiFair,
  faWifiWeak,
} from "@fortawesome/pro-duotone-svg-icons";
import { Trans, useTranslation } from "react-i18next";
import {
  faCheck,
  faChevronRight,
  faQuestion,
} from "@fortawesome/pro-solid-svg-icons";
import {
  DebugScreenSwitcher,
  HelpLink,
  InfoWrapper,
} from "components/SettingsDevices/SettingsDevicesNew";
import EpaperFrame from "components/SettingsDevices/EpaperFrame";
import DebugErrorDetails from "components/SettingsDevices/DebugErrorDetails";
import { useDebug } from "helpers/useCurrentUser";
import { faCheckCircle } from "@fortawesome/pro-light-svg-icons";
import { faEye, faEyeSlash } from "@fortawesome/pro-regular-svg-icons";

const bluetoothDebugScreens = [
  { value: "live", label: "Live state" },
  { value: "intro", label: "Wi-Fi setup introduction" },
  { value: "initializing", label: "Connecting Bluetooth" },
  { value: "networks-loading", label: "Loading Wi-Fi networks" },
  { value: "networks-display", label: "Select Wi-Fi network" },
  { value: "network-password", label: "Enter Wi-Fi password" },
  { value: "wifi-written", label: "Wi-Fi setup completed" },
  { value: "bluetooth-disabled", label: "Bluetooth not allowed" },
  { value: "location-error", label: "Location sharing required" },
  { value: "networks-not-found", label: "No Wi-Fi networks" },
  { value: "permission-error", label: "No Bluetooth permission" },
  { value: "unsupported", label: "Bluetooth unsupported" },
  { value: "bluetooth-error", label: "Bluetooth connection error" },
] as const;

type BluetoothDebugScreen = (typeof bluetoothDebugScreens)[number]["value"];

type BluetoothDebugState = {
  initializedBle: boolean;
  connectionState?: string | null;
  connectionError?: any;
  wifiNetworks?: { ssid: string; rssi: number }[] | null;
};

const debugWifiNetworks = [
  { ssid: "paperlesspaper-2.4", rssi: -42 },
  { ssid: "Home Network", rssi: -61 },
  { ssid: "Weak Network", rssi: -78 },
];

const getBluetoothDebugState = (
  screen: BluetoothDebugScreen
): BluetoothDebugState | undefined => {
  switch (screen) {
    case "intro":
      return { initializedBle: false };
    case "initializing":
      return { initializedBle: true, connectionState: "initizalize-ble" };
    case "networks-loading":
      return {
        initializedBle: true,
        connectionState: "wifi-networks-loading",
      };
    case "networks-display":
      return {
        initializedBle: true,
        connectionState: "wifi-networks-display",
        wifiNetworks: debugWifiNetworks,
      };
    case "network-password":
      return {
        initializedBle: true,
        connectionState: "wifi-networks-password",
        wifiNetworks: debugWifiNetworks,
      };
    case "wifi-written":
      return { initializedBle: true, connectionState: "wifi-written" };
    case "bluetooth-disabled":
      return { initializedBle: true, connectionState: "ble-enabled-error" };
    case "location-error":
      return { initializedBle: true, connectionState: "location-error" };
    case "networks-not-found":
      return {
        initializedBle: true,
        connectionState: "wifi-networks-not-found",
      };
    case "permission-error":
      return {
        initializedBle: true,
        connectionState: "ble-error",
        connectionError: {
          error: { errorMessage: "BLE permission denied" },
        },
      };
    case "unsupported":
      return {
        initializedBle: true,
        connectionState: "ble-error",
        connectionError: { error: { code: "UNAVAILABLE" } },
      };
    case "bluetooth-error":
      return {
        initializedBle: true,
        connectionState: "ble-error",
        connectionError: {
          error: { message: "Debug Bluetooth connection error" },
          message: "Debug Bluetooth connection error",
          position: "debug",
        },
      };
    default:
      return undefined;
  }
};

export default function BluetoothWifiProvisioning({
  setAllowSubmit,
  continueProcess,
  bottom,
  formValues,
  startTimer,
  debugPreview,
}: any) {
  const {
    connectionState,
    connectionError,
    setConnectionState,
    ...bluetoothWifiProvisioning
  } = useBluetoothWifiProvisioning({
    continueProcess,
    deviceId: formValues.deviceId,
  });

  const { control, register, handleSubmit, watch, setValue, setFocus } =
    useForm();
  const formRef = useRef<HTMLFormElement | null>(null);

  const isDebug = useDebug();
  const [debugScreen, setDebugScreen] = useState<BluetoothDebugScreen>("live");
  const debugState = isDebug ? getBluetoothDebugState(debugScreen) : undefined;
  const hasDebugState = !!debugState;
  const isDebugPreview = hasDebugState || debugPreview;
  const displayedInitializedBle = hasDebugState
    ? debugState.initializedBle
    : bluetoothWifiProvisioning.initializedBle;
  const displayedConnectionState = hasDebugState
    ? debugState.connectionState
    : connectionState;
  const displayedConnectionError = hasDebugState
    ? debugState.connectionError || {}
    : connectionError;
  const displayedWifiNetworks = hasDebugState
    ? debugState.wifiNetworks
    : bluetoothWifiProvisioning.wifiNetworks;

  useEffect(() => {
    setAllowSubmit(false);

    return () => {
      setAllowSubmit(true);
    };
  }, []);

  useEffect(() => {
    if (displayedConnectionState === "wifi-networks-password") {
      setFocus("password");
    }
  }, [displayedConnectionState, setFocus]);

  useEffect(() => {
    if (debugScreen === "network-password") {
      setValue("ssid", debugWifiNetworks[0].ssid);
      setValue("ssidManual", false);
    }
  }, [debugScreen, setValue]);

  const onSubmit = (data, e) => {
    e.preventDefault();

    if (isDebugPreview) {
      setDebugScreen("wifi-written");
      return;
    }

    const submitData = {
      ssid: data.ssid,
      password: data.password,
    };
    bluetoothWifiProvisioning.writeWifiCredentials(submitData);

    if (startTimer) startTimer();
  };

  const initializeBle = () => {
    if (isDebugPreview) {
      setDebugScreen("initializing");
      return;
    }

    void bluetoothWifiProvisioning.initializeBle();
  };

  const showPasswordScreen = () => {
    if (isDebugPreview) {
      setDebugScreen("network-password");
      return;
    }

    setConnectionState("wifi-networks-password");
  };

  const continueWifiProvisioning = () => {
    if (isDebugPreview) return;
    continueProcess();
  };

  const openAppSettings = () => {
    if (isDebugPreview) return;
    void bluetoothWifiProvisioning.openAppSettings();
  };

  const openLocationSettings = () => {
    if (isDebugPreview) return;
    void bluetoothWifiProvisioning.openLocationSettings();
  };

  const watchFields = watch();

  const allowSubmitWifi = watchFields.ssidManual || watchFields.ssid;

  const allowSubmitPassword =
    (watchFields.ssidManual || watchFields.ssid) && watchFields.password;
  const bluetoothHelpHref = `${
    import.meta.env.REACT_APP_SERVER_WEBSITE_URL
  }/aktivierung`;
  const bluetoothDiagnostics = {
    debug: {
      enabled: isDebug,
      selectedScreen: isDebug ? debugScreen : undefined,
      previewActive: isDebugPreview,
      localDebugStateActive: hasDebugState,
    },
    provisioning: {
      actualConnectionState: connectionState,
      displayedConnectionState,
      initializedBle: displayedInitializedBle,
      actualInitializedBle: bluetoothWifiProvisioning.initializedBle,
      connectionError: displayedConnectionError,
      deviceId: formValues.deviceId,
      bluetoothInternals: bluetoothWifiProvisioning.debugInfo,
      hasContinueCallback: typeof continueProcess === "function",
      hasTimerCallback: typeof startTimer === "function",
      webBluetoothAvailable: "bluetooth" in navigator,
    },
    wifi: {
      networkCount: displayedWifiNetworks?.length || 0,
      networks: displayedWifiNetworks,
      networkSelected: !!watchFields.ssid,
      manualNetworkSelected: !!watchFields.ssidManual,
      passwordProvided: !!watchFields.password,
      canSubmitNetwork: !!allowSubmitWifi,
      canSubmitPassword: !!allowSubmitPassword,
    },
  };

  const appname: any = "paperless";
  const DEVICEID: any = formValues.deviceId;

  const { t } = useTranslation();
  // If browser does not support Bluetooth return error
  // Check if it a chromium based browser

  return (
    <>
      {isDebug && (
        <DebugScreenSwitcher<BluetoothDebugScreen>
          id="bluetooth-provisioning-debug-screen"
          label="Bluetooth screen"
          value={debugScreen}
          options={bluetoothDebugScreens}
          onChange={setDebugScreen}
        />
      )}
      {!displayedInitializedBle ? (
        <InfoWrapper
          bottom={
            <Button
              onClick={initializeBle}
              large
              className={styles.pressedButton}
              icon={<FontAwesomeIcon icon={faChevronRight} />}
            >
              <Trans>Setup WiFi</Trans>
            </Button>
          }
          image={
            <EpaperFrame
              heading={<Trans>Activate device</Trans>}
              text={
                <Trans i18nKey="SCAN_OR_OPEN_APP">
                  Scan or open <span>{{ APPNAME: appname } as any}</span> App
                </Trans>
              }
            />
          }
        >
          <p>
            <Trans>Connect WiFi</Trans>

            <small>
              <Trans>
                In the next step, you will be asked to enable Bluetooth and
                Location services to connect to the device.
              </Trans>
              {/* <Link onClick={continueProcess}>
                <Trans>Skip WI-FI Setup</Trans>
              </Link> */}
            </small>
          </p>
          <br />
          {/* <HelpLink
            href={`${
              import.meta.env.REACT_APP_SERVER_WEBSITE_URL
            }/posts/einrichtung-quick-start`}
          /> */}
        </InfoWrapper>
      ) : displayedConnectionState === "initizalize-ble" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading={<Trans>Activate device</Trans>}
              text={
                <Trans i18nKey="SCAN_OR_OPEN_APP">
                  Scan or open <span>{{ APPNAME: appname } as any}</span> App
                </Trans>
              }
            />
          }
        >
          <p>
            <Trans>Connect Bluetooth</Trans>
            <small>
              <Trans
                i18nKey="PLEASE_CONNECT_BLUETOOTH_CONNECTION"
                // values={{ DEVICENAME: formValues.deviceId }}
              >
                A pairing request will appear shortly. Please pair with the
                device <b>{{ DEVICEID: DEVICEID } as any}</b>.
              </Trans>
            </small>
          </p>
        </InfoWrapper>
      ) : displayedConnectionState === "wifi-networks-loading" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading={<Trans>Activate device</Trans>}
              text={
                <Trans i18nKey="SCAN_OR_OPEN_APP">
                  Scan or open <span>{{ APPNAME: appname } as any}</span> App
                </Trans>
              }
            />
          }
        >
          <p>
            <Trans>Connection request</Trans>
            <small>
              <Trans
                i18nKey="PLEASE_ALLOW_BLUETOOTH_CONNECTION"
                // values={{ DEVICENAME: formValues.deviceId }}
              >
                Please allow the connection with the device{" "}
                <b>{{ DEVICEID: DEVICEID } as any}</b> via Bluetooth.
              </Trans>
            </small>
          </p>
        </InfoWrapper>
      ) : displayedConnectionState === "wifi-networks-display" ||
        (displayedConnectionState === "wifi-networks-password" &&
          displayedWifiNetworks) ? (
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          {displayedConnectionState === "wifi-networks-display" ? (
            <InfoWrapper
              bottom={
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    showPasswordScreen();
                  }}
                  className={styles.pressedButton}
                  disabled={!allowSubmitWifi}
                  large
                >
                  <Trans>Continue</Trans>
                </Button>
              }
              overflowContent
            >
              <p>
                <Trans>Select network</Trans>
                <small>
                  <Trans>Select a network and enter the password.</Trans>{" "}
                  <Trans>Only 2.4 GHz Wi-Fi networks are supported.</Trans>
                </small>
              </p>
              <ul className={styles.wifiList}>
                {displayedWifiNetworks?.map((n, i) => (
                  <React.Fragment key={i}>
                    <Controller
                      render={({ field }) => (
                        <li
                          {...field}
                          className={
                            field.value === n.ssid ? styles.active : ""
                          }
                          onClick={() => {
                            setValue("ssidManual", false);
                            field.onChange(n.ssid);
                          }}
                        >
                          <span>
                            <FontAwesomeIcon
                              icon={faCheck}
                              className={styles.checkmark}
                            />
                            {n.ssid}
                          </span>
                          <FontAwesomeIcon
                            className={styles.wifiIcon}
                            icon={
                              n.rssi < -70
                                ? faWifiWeak
                                : n.rssi < -60
                                ? faWifiFair
                                : faWifi
                            }
                          />
                        </li>
                      )}
                      name="ssid"
                      control={control}
                    />
                  </React.Fragment>
                ))}

                <Controller
                  render={({ field }) => (
                    <li
                      {...field}
                      className={`${styles.wifiNameManual} ${
                        field.value === true ? styles.active : ""
                      }`}
                      onClick={() => {
                        setValue("ssid", "");
                        field.onChange(true);
                      }}
                    >
                      <span>
                        <FontAwesomeIcon
                          icon={faCheck}
                          className={styles.checkmark}
                        />
                        <Trans>Enter WI-FI name manually</Trans>
                      </span>

                      <FontAwesomeIcon
                        icon={faQuestion}
                        className={styles.wifiIcon}
                      />
                    </li>
                  )}
                  name="ssidManual"
                  control={control}
                />
              </ul>
              <br />
            </InfoWrapper>
          ) : (
            <InfoWrapper
              bottom={
                <Button
                  type="submit"
                  className={styles.pressedButton}
                  disabled={!allowSubmitPassword}
                  large
                >
                  <Trans>Submit</Trans>
                </Button>
              }
            >
              {watchFields.ssidManual && (
                <TextInput
                  labelText={<Trans>WI-FI name</Trans>}
                  {...register("ssid")}
                  placeholder="WI-FI Name"
                  className={styles.wifiNameManual}
                />
              )}
              <PasswordInput
                labelText={<Trans>Wi-Fi Password</Trans>}
                {...register("password")}
                placeholder={t("Password")}
                className={styles.passwordInput}
                showPasswordLabelText={<FontAwesomeIcon icon={faEye} />}
                hidePasswordLabelText={<FontAwesomeIcon icon={faEyeSlash} />}
              />
            </InfoWrapper>
          )}
        </form>
      ) : displayedConnectionState === "wifi-written" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading={<Trans>Device connected</Trans>}
              text="..."
              icon={faCheckCircle}
            />
          }
        >
          <p>
            <Trans>WiFi setup completed</Trans>

            <small>
              <Trans>
                The display should show &quot;Device connected&quot; in
                approximately 20 seconds.
              </Trans>
            </small>
            <Button
              onClick={continueWifiProvisioning}
              className={styles.pressedButton}
              large
            >
              <Trans>Continue</Trans>
            </Button>
          </p>
        </InfoWrapper>
      ) : displayedConnectionState === "ble-enabled-error" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading="Error"
              text={<Trans>There was an error</Trans>}
            />
          }
        >
          <p>
            <Trans>Bluetooth not allowed</Trans>
            <small>
              <Trans>Please ensure that Bluetooth is enabled.</Trans>
            </small>
            <Button
              onClick={openAppSettings}
              className={styles.pressedButton}
              large
            >
              <Trans>Open app settings</Trans>
            </Button>
          </p>
          <DebugErrorDetails
            area="Bluetooth provisioning"
            state="bluetooth-disabled"
            error={displayedConnectionError}
            context={bluetoothDiagnostics}
            helpLink={
              <HelpLink className={styles.helpLink} href={bluetoothHelpHref} />
            }
          />
        </InfoWrapper>
      ) : displayedConnectionState === "location-error" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading="Error"
              text={<Trans>There was an error</Trans>}
            />
          }
        >
          <p>
            <Trans>Location sharing required</Trans>
            <small>
              <Trans>
                The app requires location sharing to connect to the photo frame
                via Bluetooth. After the initial setup, it can be disabled
                again.
              </Trans>
            </small>
            <Button
              onClick={openLocationSettings}
              className={styles.pressedButton}
              large
            >
              <Trans>Location sharing</Trans>
            </Button>
          </p>
          <DebugErrorDetails
            area="Bluetooth provisioning"
            state="location-required"
            error={displayedConnectionError}
            context={bluetoothDiagnostics}
            helpLink={
              <HelpLink className={styles.helpLink} href={bluetoothHelpHref} />
            }
          />
        </InfoWrapper>
      ) : displayedConnectionState === "wifi-networks-not-found" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading="Error"
              text={<Trans>There was an error</Trans>}
            />
          }
        >
          <p>
            <Trans>No Wi-Fi network found</Trans>
            <small>
              <Trans>
                Please ensure that Wi-Fi networks are available nearby.
              </Trans>
            </small>
            <Button
              onClick={initializeBle}
              className={styles.pressedButton}
              large
            >
              <Trans>Restart</Trans>
            </Button>
          </p>
          <DebugErrorDetails
            area="Bluetooth provisioning"
            state="wifi-networks-not-found"
            error={displayedConnectionError}
            context={bluetoothDiagnostics}
            helpLink={
              <HelpLink className={styles.helpLink} href={bluetoothHelpHref} />
            }
          />
        </InfoWrapper>
      ) : displayedConnectionState === "ble-error" &&
        displayedConnectionError?.error?.errorMessage ===
          "BLE permission denied" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading="Error"
              text={<Trans>There was an error</Trans>}
            />
          }
        >
          <p>
            <Trans>No Bluetooth permission</Trans>
            <small>
              <Trans>
                To connect the device, the app needs access to Bluetooth. Please
                allow access.
              </Trans>
            </small>
            <Button
              onClick={openAppSettings}
              className={styles.pressedButton}
              large
            >
              <Trans>Open app settings</Trans>
            </Button>
          </p>
          <DebugErrorDetails
            area="Bluetooth provisioning"
            state="bluetooth-permission-denied"
            error={displayedConnectionError}
            context={bluetoothDiagnostics}
            helpLink={
              <HelpLink className={styles.helpLink} href={bluetoothHelpHref} />
            }
          />
        </InfoWrapper>
      ) : displayedConnectionState === "ble-error" &&
        displayedConnectionError?.error?.code === "UNAVAILABLE" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading="Error"
              text={<Trans>Bluetooth not supported</Trans>}
            />
          }
        >
          <p>
            <Trans>Bluetooth is not supported in your browser</Trans>
            <small>
              <Trans>
                Your browser does not support Web Bluetooth yet. Please use
                Google Chrome or the app instead.
              </Trans>
            </small>
            <Button
              href="https://paperlesspaper.de/download"
              className={styles.pressedButton}
              large
              target="_blank"
            >
              <Trans>Download App</Trans>
            </Button>
          </p>
          <DebugErrorDetails
            area="Bluetooth provisioning"
            state="bluetooth-unsupported"
            error={displayedConnectionError}
            context={bluetoothDiagnostics}
            helpLink={
              <HelpLink className={styles.helpLink} href={bluetoothHelpHref} />
            }
          />
        </InfoWrapper>
      ) : displayedConnectionState === "ble-error" ? (
        <InfoWrapper
          bottom={bottom}
          image={
            <EpaperFrame
              heading="Error"
              text={<Trans>There was an error</Trans>}
            />
          }
        >
          <p>
            <Trans>Bluetooth connection terminated</Trans>
            <small>
              <Trans>
                Please restart and ensure that Bluetooth is enabled.
              </Trans>
            </small>
            <Button
              onClick={initializeBle}
              className={styles.pressedButton}
              large
            >
              <Trans>Restart</Trans>
            </Button>
          </p>
          <DebugErrorDetails
            area="Bluetooth provisioning"
            state="bluetooth-connection-error"
            error={displayedConnectionError}
            context={bluetoothDiagnostics}
            helpLink={
              <HelpLink className={styles.helpLink} href={bluetoothHelpHref} />
            }
          />
        </InfoWrapper>
      ) : null}
    </>
  );
}

/*
   <Button
              className={styles.pressedButton}
              onClick={() =>
                submitNewDigitalDevice({ deviceId: formValues.deviceId })
              }
              large
              icon={<FontAwesomeIcon icon={faChevronRight} />}
            >
              Wifi onboarding überspringen
            </Button>
            */
