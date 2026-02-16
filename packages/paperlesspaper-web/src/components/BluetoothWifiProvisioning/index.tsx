import React, { useEffect, useRef } from "react";
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
  HelpLink,
  InfoWrapper,
} from "components/SettingsDevices/SettingsDevicesNew";
import EpaperFrame from "components/SettingsDevices/EpaperFrame";
import { useDebug } from "helpers/useCurrentUser";
import JsonViewer from "components/JsonViewer";
import { faCheckCircle } from "@fortawesome/pro-light-svg-icons";
import { faEye, faEyeSlash } from "@fortawesome/pro-regular-svg-icons";

export default function BluetoothWifiProvisioning({
  setAllowSubmit,
  continueProcess,
  bottom,
  formValues,
  startTimer,
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

  useEffect(() => {
    setAllowSubmit(false);

    return () => {
      setAllowSubmit(true);
    };
  }, []);

  useEffect(() => {
    if (connectionState === "wifi-networks-password") {
      setFocus("password");
    }
  }, [connectionState, setFocus]);

  const onSubmit = (data, e) => {
    e.preventDefault();

    const submitData = {
      ssid: data.ssid,
      password: data.password,
    };
    bluetoothWifiProvisioning.writeWifiCredentials(submitData);

    if (startTimer) startTimer();
  };

  const watchFields = watch();

  const allowSubmitWifi = watchFields.ssidManual || watchFields.ssid;

  const allowSubmitPassword =
    (watchFields.ssidManual || watchFields.ssid) && watchFields.password;

  const appname: any = "paperless";
  const DEVICEID: any = formValues.deviceId;

  const { t } = useTranslation();
  // If browser does not support Bluetooth return error
  // Check if it a chromium based browser

  return (
    <>
      {!bluetoothWifiProvisioning.initializedBle ? (
        <InfoWrapper
          bottom={
            <Button
              onClick={bluetoothWifiProvisioning.initializeBle}
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
      ) : connectionState === "initizalize-ble" ? (
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
      ) : connectionState === "wifi-networks-loading" ? (
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
      ) : connectionState === "wifi-networks-display" ||
        (connectionState === "wifi-networks-password" &&
          bluetoothWifiProvisioning.wifiNetworks) ? (
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          {connectionState === "wifi-networks-display" ? (
            <InfoWrapper
              bottom={
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    setConnectionState("wifi-networks-password");
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
                  <Trans>Select a network and enter the password.</Trans>
                </small>
              </p>
              <ul className={styles.wifiList}>
                {bluetoothWifiProvisioning.wifiNetworks.map((n, i) => (
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
                      className={`${styles.wifiNameManual} ${field.value === true ? styles.active : ""}`}
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
      ) : connectionState === "wifi-written" ? (
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
              onClick={continueProcess}
              className={styles.pressedButton}
              large
            >
              <Trans>Continue</Trans>
            </Button>
          </p>
        </InfoWrapper>
      ) : connectionState === "ble-enabled-error" ? (
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
              onClick={bluetoothWifiProvisioning.openAppSettings}
              className={styles.pressedButton}
              large
            >
              <Trans>Open app settings</Trans>
            </Button>
            {isDebug && <JsonViewer src={connectionError} />}
          </p>
        </InfoWrapper>
      ) : connectionState === "location-error" ? (
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
              onClick={bluetoothWifiProvisioning.openLocationSettings}
              className={styles.pressedButton}
              large
            >
              <Trans>Location sharing</Trans>
            </Button>
            {isDebug && <JsonViewer src={connectionError} />}
          </p>
        </InfoWrapper>
      ) : connectionState === "wifi-networks-not-found" ? (
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
              onClick={bluetoothWifiProvisioning.initializeBle}
              className={styles.pressedButton}
              large
            >
              <Trans>Restart</Trans>
            </Button>
            <HelpLink
              className={styles.helpLink}
              href={`${
                import.meta.env.REACT_APP_SERVER_WEBSITE_URL
              }/aktivierung`}
            />
            {isDebug && <JsonViewer src={connectionError} />}
          </p>
        </InfoWrapper>
      ) : connectionState === "ble-error" &&
        connectionError?.error?.errorMessage === "BLE permission denied" ? (
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
              onClick={bluetoothWifiProvisioning.openAppSettings}
              className={styles.pressedButton}
              large
            >
              <Trans>Open app settings</Trans>
            </Button>
            {isDebug && <JsonViewer src={connectionError} />}
          </p>
        </InfoWrapper>
      ) : connectionState === "ble-error" &&
        connectionError?.error?.code === "UNAVAILABLE" ? (
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
            <HelpLink
              className={styles.helpLink}
              href={`${
                import.meta.env.REACT_APP_SERVER_WEBSITE_URL
              }/aktivierung`}
            />
            {isDebug && <JsonViewer src={connectionError} />}
          </p>
        </InfoWrapper>
      ) : connectionState === "ble-error" ? (
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
              onClick={bluetoothWifiProvisioning.initializeBle}
              className={styles.pressedButton}
              large
            >
              <Trans>Restart</Trans>
            </Button>
            <HelpLink
              className={styles.helpLink}
              href={`${
                import.meta.env.REACT_APP_SERVER_WEBSITE_URL
              }/aktivierung`}
            />
            {isDebug && <JsonViewer src={connectionError} />}
          </p>
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
