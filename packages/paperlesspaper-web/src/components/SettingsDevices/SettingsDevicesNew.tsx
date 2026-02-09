import React, { useEffect, useState } from "react";

import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import { devicesApi } from "ducks/devices";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import useSettingsForm from "helpers/useSettingsFormNew";
import { Button, Link, TextInput } from "@progressiveui/react";
import styles from "./settingsDevicesDetail.module.scss";
import ScanButton from "components/Scanner/ScanButton";
import devicesError from "./illustrations/device-error.png";
import deviceSuccess from "./illustrations/device-success.png";
import qrDevices from "./illustrations/qr-scan.mp4";
import qrDevicesButton from "./illustrations/QR-Button-press.mp4";
import { useDebug } from "helpers/useCurrentUser";
import ButtonRouter from "components/ButtonRouter";
import classnames from "classnames";
import InlineLoadingLarge from "components/InlineLoadingLarge";
// TODO: import emptyPixel from "./illustrations/1x1.png";
import useQs from "helpers/useQs";
import useTimer from "./useTime";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faExternalLink,
} from "@fortawesome/pro-solid-svg-icons";
import { useIsDesktop } from "@internetderdinge/web";
import EpaperFrame from "./EpaperFrame";
// import BluetoothWifiProvisioning from "components/BluetoothWifiProvisioning";
import JsonViewer from "components/JsonViewer";
import BluetoothWifiProvisioning from "components/BluetoothWifiProvisioning";
import { faCheckCircle } from "@fortawesome/pro-regular-svg-icons";
import {
  deviceByDeviceName,
  deviceKindHasFeature,
} from "helpers/devices/deviceList";

export function HelpLink({ href, className }: any) {
  return (
    <Link
      className={classnames(styles.helpLink, className)}
      href={
        href
          ? href
          : `${
              import.meta.env.REACT_APP_SERVER_WEBSITE_URL
            }/posts/aktivierung#error`
      }
      target="_blank"
      rel="noreferrer"
    >
      <Trans>Help for Activation</Trans>{" "}
      <FontAwesomeIcon icon={faExternalLink} />
    </Link>
  );
}

export function InfoWrapper({
  bottom,
  className,
  children,
  image,
  imagePosition = "cover",
  overflowContent,
}: any) {
  const infoWrapperClasses = classnames(
    styles.infoWrapper,
    {
      [styles.overflowContent]: overflowContent,
    },
    className,
  );

  return (
    <div className={infoWrapperClasses}>
      {image && (
        <div className={`${styles.infoWrapperImageContainer} ${imagePosition}`}>
          <div className={styles.infoWrapperImage}>{image}</div>
        </div>
      )}
      <div className={styles.textContent}>{children}</div>
      <div className={styles.bottom}>{bottom}</div>
    </div>
  );
}

export default function SettingsDevicesNew({
  components,
  onboardingDialog,
}: any) {
  const params = useParams();
  const [formValues, setValues] = useState<any>();

  const [response, setResponse] = useState<any>();
  const [step, setStep] = useState<string>("start");
  const isDesktop = useIsDesktop();

  const debug = useDebug();
  const { t } = useTranslation();

  const [allowSubmit, setAllowSubmit] = useState(true);

  const resetSingle = () => {
    setStep("start");
    setResponse(undefined);
    setValues(undefined);
    resetTimer();
  };

  const { patient, user, organization } = useQs();
  const [registerDevice, registerDeviceResult] =
    devicesApi.useRegisterDeviceMutation();

  const submitNewDigitalDevice = (values) => {
    const deviceKind = deviceByDeviceName(values.deviceId);
    const hasWifi = deviceKindHasFeature("wifi", deviceKind?.id);
    if (hasWifi && step === "start" && values.wifiStatus === "99") {
      console.log("Submit device registration", values);
      setStep("onboarding-sleep-error");
    } else if (hasWifi && step === "start" && values.wifiStatus !== "1") {
      console.log("Start wifi onboarding", values);
      setStep("onboarding-wifi");
      setValues(values);
    } else {
      const submitValues = {
        id: values.deviceId.replace(/\s/g, ""),
        body: {
          organization: params.organization || organization,
          enable: true,
          patient: patient || user,
        },
      };
      setStep("onboarding");
      registerDevice(submitValues);
      setValues(submitValues);
    }
  };

  const { time, startTimer, resetTimer, intervalID } = useTimer(60);

  useEffect(() => {
    if (registerDeviceResult.data) setResponse(registerDeviceResult);
    if (
      step === "onboarding" &&
      registerDeviceResult.data?.activation_status &&
      registerDeviceResult.data?.activation_status !== "success" &&
      registerDeviceResult.data?.activation_status !== "timeout"
    ) {
      setTimeout(() => {
        if (registerDeviceResult.data?.activation_status !== "error") {
          formValues.body.enable = false;
        }
        registerDevice({ ...formValues, patient });
      }, 4000);
    }
  }, [registerDeviceResult.data?.activation_status]);

  const setDeviceId = (e) => {
    // if e is string
    if (typeof e === "string") {
      setValue("deviceId", e);
      submitNewDigitalDevice({ deviceId: e });
      return;
    }
    setValue("deviceId", e.d);
    setValue("wifiStatus", e.w);
    submitNewDigitalDevice({ deviceId: e.d, wifiStatus: e.w });
  };

  const continueAfterWifiOnboarding = () => {
    submitNewDigitalDevice({ deviceId: formValues.deviceId });
  };

  const store = useSettingsForm({
    api: devicesApi,
    customSubmit: submitNewDigitalDevice,
  });

  const {
    form: {
      formState: { errors },
      register,
      setValue,
      watch,
    },
  } = store;

  const manually = watch("manually");
  const deviceIdWatch = watch("deviceId");

  const cancelButton = (
    <div className={styles.cancelButton}>
      <Button onClick={resetSingle} kind="tertiary">
        <Trans>Cancel</Trans>
      </Button>
    </div>
  );

  const appname: any = "paperless";

  const deviceKind = deviceByDeviceName(deviceIdWatch);
  const hasWifi = deviceKindHasFeature("wifi", deviceKind?.id);

  return (
    <SettingsContentWrapper
      {...store}
      hideMessages
      fullHeight
      disableClosePrompt
      components={components}
      wrapperClasses={styles.wrapper}
      handleSubmit={allowSubmit ? store.handleSubmit : undefined}
      resultCreateSingle={registerDeviceResult}
      hideSubmitButton
      title={
        isDesktop ? (
          <Trans>Register new device</Trans>
        ) : (
          <Trans>New device</Trans>
        )
      }
    >
      {step === "start" && (
        <>
          <InfoWrapper
            bottom={
              <div className={styles.buttonWrapper}>
                <ScanButton
                  autoSubmit
                  buttonClassName={styles.buttonClassName}
                  scale={0.7}
                  dataTestId="scan-code-button"
                  buttonText={
                    <Trans>
                      {isDesktop ? "Scan code with Webcam" : "Scan code"}
                    </Trans>
                  }
                  // scanType="data_matrix"
                  large
                  setValue={setDeviceId}
                />

                {!manually ? (
                  <ButtonRouter
                    isPlain
                    className={styles.analogButton}
                    data-testId="type-code-button"
                    onClick={() => setValue("manually", !manually)}
                  >
                    <Trans>Or type code</Trans>
                  </ButtonRouter>
                ) : (
                  <div className={styles.manuallyWrapper}>
                    <TextInput
                      {...register("deviceId", {
                        required: true,
                        minLength: 16,
                        maxLength: 19,
                      })}
                      invalid={errors.deviceId}
                      placeholder={t("16 to 19-digit code")}
                      invalidText={t("Device Id not valid")}
                    />
                    <Button
                      // dataTestId="add-button"
                      form="settings-form"
                      type="submit"
                    >
                      <Trans>Add device</Trans>
                    </Button>
                  </div>
                )}
              </div>
            }
            image={
              <EpaperFrame
                heading="Gerät aktivieren"
                text={
                  <Trans i18nKey="SCAN_OR_OPEN_APP">
                    Scan or open <span>{{ APPNAME: appname } as any}</span> App
                  </Trans>
                }
              />
            }
          >
            <p>
              <Trans>Scan the code on the display</Trans>
              <small>
                <div className={styles.wifiSetupInfo}>
                  <Trans>
                    Can’t see the QR code? Press the button on the back of the
                    frame and check that the device has batteries.
                  </Trans>
                  {/*} <Trans i18nKey="WIFISETUPINTRO">
                    Make sure the device has loaded batteries and is connected
                    to the wifi. <br /> If you see the "Wifi Setup" screen,
                    please see this guide first:
              </Trans>*/}
                  {/*<br />
                  <Button
                    href="https://paperlesspaper.de/setup"
                    icon={<FontAwesomeIcon icon={faWifi} />}
                    target="_blank"
                    kind="danger--primary"
                    className={styles.setupButton}
                  >
                    <Trans>Wifi Setup Guide</Trans>
              </Button>*/}
                </div>
              </small>
            </p>
          </InfoWrapper>
        </>
      )}
      {step === "onboarding" && registerDeviceResult.isError ? (
        <>
          <InfoWrapper
            className={styles.error}
            image={
              <EpaperFrame
                heading="Error"
                text={<Trans>There was an error.</Trans>}
              />
            }
          >
            <p>
              <Trans>The registration failed</Trans>
              <small>
                {registerDeviceResult?.error?.status === 409 &&
                registerDeviceResult?.error?.data?.device?.id ? (
                  <Trans>
                    The device is already registred in your organization.
                  </Trans>
                ) : (
                  <Trans>{registerDeviceResult?.error?.data?.message}</Trans>
                )}
              </small>
            </p>
            {registerDeviceResult?.error?.status && (
              <HelpLink
                href={`${
                  import.meta.env.REACT_APP_SERVER_WEBSITE_URL
                }/posts/reset-device#zurucksetzen-des-gerates`}
              />
            )}
          </InfoWrapper>
          <div className={styles.cancelButton}>
            {registerDeviceResult?.error?.status === 409 &&
            registerDeviceResult?.error?.data?.device?.id ? (
              <ButtonRouter
                withOrganization
                to={`/devices/${registerDeviceResult?.error?.data?.device?.id}`}
              >
                <Trans>Go to device</Trans>
              </ButtonRouter>
            ) : (
              <>
                {/*<Button onClick={resetSingle} kind="tertiary">
                <Trans>Start again</Trans>
            </Button>*/}
              </>
            )}
          </div>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === undefined ? (
        <>
          <InfoWrapper bottom={cancelButton} image={<InlineLoadingLarge />}>
            <p>
              <Trans>Waiting for device...</Trans>
            </p>
          </InfoWrapper>
        </>
      ) : step === "onboarding-wifi" ? (
        <BluetoothWifiProvisioning
          bottom={cancelButton}
          setAllowSubmit={setAllowSubmit}
          continueProcess={continueAfterWifiOnboarding}
          submitNewDigitalDevice={submitNewDigitalDevice}
          formValues={formValues}
          startTimer={startTimer}
        />
      ) : step === "onboarding-sleep-error" ? (
        <>
          <InfoWrapper
            className={styles.error}
            bottom={
              <div className={styles.cancelButton}>
                <Button onClick={resetSingle} kind="tertiary">
                  <Trans>Start again</Trans>
                </Button>
              </div>
            }
            image={
              <EpaperFrame
                heading="Error"
                text={<Trans>I am sleeping...</Trans>}
              />
            }
          >
            <p>
              <Trans>Device sleeping</Trans>
              <small>
                <Trans>
                  Please press the button on the back of the frame to wake it
                  up.
                </Trans>
              </small>
            </p>
          </InfoWrapper>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "pending" &&
        !hasWifi &&
        intervalID === null ? (
        <>
          <InfoWrapper
            bottom={cancelButton}
            image={<EpaperFrame heading="Error" text="Es gab einen Fehler" />}
          >
            <p>
              <Trans>Press and hold the side button for 2 seconds</Trans>
              <small>
                <Trans>
                  If the device displays a loading animation, please press
                  Continue.
                </Trans>
              </small>
              <Button
                className={styles.pressedButton}
                onClick={() => startTimer()}
                large
                data-testId="pressed-button"
                icon={<FontAwesomeIcon icon={faChevronRight} />}
              >
                <Trans>Button was pressed</Trans>
              </Button>
            </p>
          </InfoWrapper>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "pending" ? (
        <>
          <InfoWrapper
            bottom={cancelButton}
            image={
              hasWifi ? (
                <EpaperFrame
                  heading={<Trans>Activate device</Trans>}
                  text={<Trans>Open the wirewire app and add the device</Trans>}
                />
              ) : (
                <video autoPlay loop muted playsInline className={styles.video}>
                  <source src={qrDevicesButton} type="video/mp4" />
                </video>
              )
            }
          >
            <p>
              <span>
                <Trans i18nKey="PLEASE_WAIT_SECONDS">
                  Please wait <span>{{ time: time } as any}</span> seconds
                </Trans>
              </span>
              <small>
                <Trans>Your device is being connected...</Trans>
              </small>
            </p>
          </InfoWrapper>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "reset" ? (
        <>
          <InfoWrapper
            className={styles.error}
            image={
              <EpaperFrame
                heading={<Trans>Error</Trans>}
                text={<Trans>There was an error.</Trans>}
              />
            }
          >
            <p>
              <Trans>
                Activation was reset. The device can&apos;t be used.
              </Trans>
            </p>
            <HelpLink />
          </InfoWrapper>
          <div className={styles.cancelButton}>
            <Button onClick={resetSingle} kind="tertiary">
              <Trans>Start again</Trans>
            </Button>
          </div>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "device_confirmed" ? (
        <>
          <InfoWrapper
            bottom={cancelButton}
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
              <Trans>You pressed the button. Waiting for activation...</Trans>
            </p>
          </InfoWrapper>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "timeout" ? (
        <>
          <InfoWrapper
            className={styles.error}
            image={
              <EpaperFrame
                heading="Timeout"
                text={
                  <Trans i18nKey="SCAN_OR_OPEN_APP">
                    Scan or open <span>{{ APPNAME: appname } as any}</span> App
                  </Trans>
                }
              />
            }
          >
            <p>
              <Trans>No button press was recognized. Please start again.</Trans>
            </p>
          </InfoWrapper>
          <div className={styles.cancelButton}>
            <Button onClick={resetSingle} kind="tertiary">
              <Trans>Start again</Trans>
            </Button>
          </div>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "success" ? (
        <>
          <InfoWrapper
            bottom={
              <div className={styles.cancelButton}>
                <ButtonRouter
                  withOrganization={onboardingDialog ? false : true}
                  id="devicesNewSuccessButton"
                  to={
                    onboardingDialog
                      ? onboardingDialog
                      : hasWifi
                        ? `/calendar/device/${response?.data?.createdDevice?.id}`
                        : `/devices/${response?.data?.createdDevice?.id}`
                  }
                >
                  {onboardingDialog ? (
                    <Trans>Continue</Trans>
                  ) : hasWifi ? (
                    <Trans>Upload first image</Trans>
                  ) : (
                    <Trans>Go to device settings</Trans>
                  )}
                </ButtonRouter>
              </div>
            }
            className={styles.success}
            image={
              hasWifi ? (
                <EpaperFrame
                  heading="Aktivierung abgeschlosen"
                  text={<Trans>You can now upload your first image</Trans>}
                  icon={faCheckCircle}
                  kind="success"
                />
              ) : (
                <img alt="Scan introduction" src={deviceSuccess} />
              )
            }
          >
            <p>
              <Trans>Device successfully activated</Trans>
              <small>
                <Trans>You can use the device now.</Trans>
              </small>
            </p>
          </InfoWrapper>
        </>
      ) : step === "onboarding" &&
        response?.data?.activation_status === "reset" ? (
        <>
          <InfoWrapper
            className={styles.error}
            image={<img alt="Scan introduction" src={devicesError} />}
          >
            <p>
              <Trans>Activation took too long</Trans>
              <small>
                <Trans>Please try again.</Trans>
              </small>
            </p>
            <HelpLink />
          </InfoWrapper>
          <div className={styles.cancelButton}>
            <Button onClick={resetSingle} kind="tertiary">
              <Trans>Start again</Trans>
            </Button>
          </div>
        </>
      ) : null}

      {/* debug && (
        <div className={styles.debug}>
          Step: {step} <br />
          RegisterDeviceResult:
          <JsonViewer src={registerDeviceResult} />
          Response:
          <JsonViewer src={response} />
        </div>
      ) */}
    </SettingsContentWrapper>
  );
}
