import React, { useEffect, useRef, useState } from "react";

import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import { devicesApi } from "ducks/devices";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import useSettingsForm from "helpers/useSettingsFormNew";
import {
  Button,
  Link,
  Select,
  SelectItem,
  TextInput,
} from "@progressiveui/react";
import styles from "./settingsDevicesDetail.module.scss";
import ScanButton from "components/Scanner/ScanButton";
import ButtonRouter from "components/ButtonRouter";
import classnames from "classnames";
import InlineLoadingLarge from "components/InlineLoadingLarge";
// TODO: import emptyPixel from "./illustrations/1x1.png";
import useQs, { getQueryStringValue } from "helpers/useQs";
import useTimer from "./useTime";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLink } from "@fortawesome/pro-solid-svg-icons";
import { useIsDesktop } from "@internetderdinge/web";
import EpaperFrame from "./EpaperFrame";
// import BluetoothWifiProvisioning from "components/BluetoothWifiProvisioning";
import BluetoothWifiProvisioning from "components/BluetoothWifiProvisioning";
import { faCheckCircle } from "@fortawesome/pro-regular-svg-icons";
import {
  deviceByDeviceName,
  deviceKindHasFeature,
} from "helpers/devices/deviceList";
import { useDebug } from "helpers/useCurrentUser";
import DebugErrorDetails from "./DebugErrorDetails";

type DebugScreenOption<T extends string> = {
  value: T;
  label: string;
};

export function DebugScreenSwitcher<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly DebugScreenOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.debugScreenSwitcher} data-testid={id}>
      <Select
        id={`${id}-select`}
        hideLabel
        labelText={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            text={option.label}
          />
        ))}
      </Select>
    </div>
  );
}

const registrationDebugScreens = [
  { value: "live", label: "Live state" },
  { value: "start", label: "Scan device code" },
  { value: "registration-error", label: "Registration error" },
  { value: "already-registered", label: "Already registered" },
  { value: "waiting", label: "Waiting for device" },
  { value: "bluetooth", label: "Bluetooth provisioning" },
  { value: "sleeping", label: "Device sleeping" },
  { value: "pending", label: "Connecting device" },
  { value: "activation-error", label: "Activation error" },
  { value: "reset", label: "Activation reset" },
  { value: "device-confirmed", label: "Device confirmed" },
  { value: "timeout", label: "Activation timeout" },
  { value: "success-wifi", label: "Success (Wi-Fi device)" },
  { value: "success-other", label: "Success (other device)" },
] as const;

type RegistrationDebugScreen =
  (typeof registrationDebugScreens)[number]["value"];

const debugDeviceId = "epd7-debug-device";

type RegistrationDebugState = {
  step: string;
  response?: any;
  registrationError?: any;
  hasWifi?: boolean;
};

const getRegistrationDebugState = (
  screen: RegistrationDebugScreen
): RegistrationDebugState | undefined => {
  const onboardingResponse = (activation_status?: string) => ({
    data: {
      activation_status,
      createdDevice: { id: "debug-device" },
      message: "Debug activation error",
    },
  });

  switch (screen) {
    case "start":
      return { step: "start" };
    case "registration-error":
      return {
        step: "onboarding",
        registrationError: {
          status: 500,
          data: { message: "Debug registration error" },
        },
      };
    case "already-registered":
      return {
        step: "onboarding",
        registrationError: {
          status: 409,
          data: {
            message: "Device already registered",
            device: { id: "debug-device" },
          },
        },
      };
    case "waiting":
      return { step: "onboarding" };
    case "bluetooth":
      return { step: "onboarding-wifi", hasWifi: true };
    case "sleeping":
      return { step: "onboarding-sleep-error", hasWifi: true };
    case "pending":
      return {
        step: "onboarding",
        response: onboardingResponse("pending"),
        hasWifi: true,
      };
    case "activation-error":
      return {
        step: "onboarding",
        response: onboardingResponse("error"),
      };
    case "reset":
      return {
        step: "onboarding",
        response: onboardingResponse("reset"),
      };
    case "device-confirmed":
      return {
        step: "onboarding",
        response: onboardingResponse("device_confirmed"),
      };
    case "timeout":
      return {
        step: "onboarding",
        response: onboardingResponse("timeout"),
      };
    case "success-wifi":
      return {
        step: "onboarding",
        response: onboardingResponse("success"),
        hasWifi: true,
      };
    case "success-other":
      return {
        step: "onboarding",
        response: onboardingResponse("success"),
        hasWifi: false,
      };
    default:
      return undefined;
  }
};

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
    className
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

const normalizeDeviceId = (deviceId?: string) =>
  deviceId ? deviceId.replace(/\s/g, "") : "";

const getApiRequestDiagnostics = (result: any) => ({
  endpointName: result?.endpointName,
  requestId: result?.requestId,
  status: result?.status,
  originalArgs: result?.originalArgs,
  startedTimeStamp: result?.startedTimeStamp,
  fulfilledTimeStamp: result?.fulfilledTimeStamp,
  isUninitialized: result?.isUninitialized,
  isLoading: result?.isLoading,
  isFetching: result?.isFetching,
  isSuccess: result?.isSuccess,
  isError: result?.isError,
  data: result?.data,
  currentData: result?.currentData,
  error: result?.error,
});

export default function SettingsDevicesNew({
  allowScroll,
  components,
  onboardingDialog,
  registrationContext,
}: any) {
  const params = useParams<{ organization?: string }>();
  const [formValues, setValues] = useState<any>();

  const [response, setResponse] = useState<any>();
  const [preflightRegistrationError, setPreflightRegistrationError] =
    useState<any>();
  const [step, setStep] = useState<string>("start");
  const [debugScreen, setDebugScreen] =
    useState<RegistrationDebugScreen>("live");
  const registrationAttemptRef = useRef(0);
  const isDesktop = useIsDesktop();
  const isDebug = useDebug();

  const { t } = useTranslation();

  const [allowSubmit, setAllowSubmit] = useState(true);

  const resetSingle = () => {
    registrationAttemptRef.current += 1;
    setStep("start");
    setResponse(undefined);
    setPreflightRegistrationError(undefined);
    setValues(undefined);
    resetTimer();
  };

  const query = useQs();
  const patient =
    registrationContext?.patient || getQueryStringValue(query.patient);
  const user = registrationContext?.user || getQueryStringValue(query.user);
  const organization = getQueryStringValue(query.organization);
  const e2eSkipWifiProvisioning =
    registrationContext?.e2eSkipWifiProvisioning ||
    getQueryStringValue(query.e2eSkipWifiProvisioning);
  const currentOrganization = params.organization || organization;
  const currentPatient = patient || user;
  const [registerDevice, registerDeviceResult] =
    devicesApi.useRegisterDeviceMutation();
  const [
    checkExistingDeviceRegistration,
    checkExistingDeviceRegistrationResult,
  ] = devicesApi.useRegisterDeviceMutation();
  const [searchDevices, searchDevicesResult, searchDevicesLastPromiseInfo] =
    devicesApi.useLazySearchDevicesQuery();

  const createDeviceRegistrationValues = (values) => ({
    id: normalizeDeviceId(values.deviceId),
    body: {
      organization: currentOrganization,
      enable: true,
      patient: currentPatient,
    },
  });

  const findExistingDeviceInOrganization = async (deviceId: string) => {
    const normalizedDeviceId = normalizeDeviceId(deviceId);

    if (!currentOrganization || !normalizedDeviceId) return undefined;

    try {
      const devices = await searchDevices({
        organization: currentOrganization,
        search: normalizedDeviceId,
      }).unwrap();

      return devices?.find(
        (device) => normalizeDeviceId(device?.deviceId) === normalizedDeviceId
      );
    } catch (error) {
      console.log("error preflight device search", error);
      return undefined;
    }
  };

  const preflightExistingDeviceRegistration = async (values) => {
    const existingDevice = await findExistingDeviceInOrganization(
      values.deviceId
    );

    if (!existingDevice) return true;

    const submitValues = createDeviceRegistrationValues(values);

    try {
      await checkExistingDeviceRegistration(submitValues).unwrap();
      return true;
    } catch (error) {
      setResponse(undefined);
      setPreflightRegistrationError(error);
      setStep("onboarding");
      setValues(submitValues);
      return false;
    }
  };

  const continueDeviceRegistration = (submitValuesInput) => {
    const deviceKind = deviceByDeviceName(submitValuesInput.deviceId);
    const hasWifi = deviceKindHasFeature("wifi", deviceKind?.id);

    if (hasWifi && step === "start" && submitValuesInput.wifiStatus === "99") {
      console.log("Submit device registration", submitValuesInput);
      setStep("onboarding-sleep-error");
    } else if (
      hasWifi &&
      step === "start" &&
      submitValuesInput.wifiStatus !== "1"
    ) {
      console.log("Start wifi onboarding", submitValuesInput);
      setStep("onboarding-wifi");
      setValues(submitValuesInput);
    } else {
      const submitValues = createDeviceRegistrationValues(submitValuesInput);

      setStep("onboarding");
      registerDevice(submitValues);
      setValues(submitValues);
    }
  };

  const submitNewDigitalDevice = (values) => {
    if (!currentOrganization) {
      setResponse(undefined);
      setPreflightRegistrationError({
        data: { message: t("Organization not found") },
      });
      setStep("onboarding");
      return false;
    }

    const attemptId = registrationAttemptRef.current + 1;
    registrationAttemptRef.current = attemptId;
    setPreflightRegistrationError(undefined);

    const submitValuesInput =
      import.meta.env.DEV && e2eSkipWifiProvisioning === "1"
        ? { ...values, wifiStatus: "1" }
        : values;

    void (async () => {
      if (step === "start") {
        const canContinue = await preflightExistingDeviceRegistration(
          submitValuesInput
        );

        if (!canContinue || registrationAttemptRef.current !== attemptId) {
          return;
        }
      }

      continueDeviceRegistration(submitValuesInput);
    })();

    return false;
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
  const registrationError =
    preflightRegistrationError || registerDeviceResult?.error;
  const registrationIsError =
    !!preflightRegistrationError || registerDeviceResult.isError;
  const debugState = isDebug
    ? getRegistrationDebugState(debugScreen)
    : undefined;
  const hasDebugState = !!debugState;
  const displayedStep = debugState?.step ?? step;
  const displayedResponse = hasDebugState ? debugState?.response : response;
  const displayedRegistrationError = hasDebugState
    ? debugState?.registrationError
    : registrationError;
  const displayedRegistrationIsError = hasDebugState
    ? !!debugState?.registrationError
    : registrationIsError;
  const displayedHasWifi = debugState?.hasWifi ?? hasWifi;
  const displayedFormValues = hasDebugState
    ? { deviceId: debugDeviceId }
    : formValues;
  const registrationDiagnostics = {
    debug: {
      enabled: isDebug,
      selectedScreen: isDebug ? debugScreen : undefined,
      previewActive: hasDebugState,
    },
    flow: {
      actualStep: step,
      displayedStep,
      activationStatus: displayedResponse?.data?.activation_status,
      secondsRemaining: time,
      timerActive: intervalID !== null,
      allowSubmit,
      onboardingDialog: !!onboardingDialog,
    },
    device: {
      id: displayedFormValues?.deviceId || deviceIdWatch,
      kind: deviceKind?.id,
      detectedDefinition: deviceKind || undefined,
      hasWifi: displayedHasWifi,
      wifiStatus: displayedFormValues?.wifiStatus,
      createdDevice: displayedResponse?.data?.createdDevice,
      conflictingDevice: displayedRegistrationError?.data?.device,
      lastSearchResults: searchDevicesResult?.data,
    },
    registration: {
      organizationId: currentOrganization,
      hasPatientContext: !!currentPatient,
      displayedResponse,
      displayedRegistrationError,
      preflightRegistrationError,
      registerDeviceResult,
    },
    apiRequests: {
      deviceSearch: {
        ...getApiRequestDiagnostics(searchDevicesResult),
        lastArgument: searchDevicesLastPromiseInfo?.lastArg,
      },
      preflightRegistration: getApiRequestDiagnostics(
        checkExistingDeviceRegistrationResult
      ),
      registration: getApiRequestDiagnostics(registerDeviceResult),
    },
  };

  return (
    <SettingsContentWrapper
      {...store}
      allowScroll={allowScroll}
      hideMessages
      fullHeight
      disableClosePrompt
      components={components}
      wrapperClasses={styles.wrapper}
      handleSubmit={
        allowSubmit && !hasDebugState ? store.handleSubmit : undefined
      }
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
      {isDebug && (
        <DebugScreenSwitcher<RegistrationDebugScreen>
          id="device-registration-debug-screen"
          label="Registration screen"
          value={debugScreen}
          options={registrationDebugScreens}
          onChange={setDebugScreen}
        />
      )}
      {displayedStep === "start" && (
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
                  setValue={hasDebugState ? () => undefined : setDeviceId}
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
      {displayedStep === "onboarding" && displayedRegistrationIsError ? (
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
                {displayedRegistrationError?.status === 409 &&
                displayedRegistrationError?.data?.device?.id ? (
                  <Trans>
                    The device is already registered in your organization.
                  </Trans>
                ) : (
                  <Trans>{displayedRegistrationError?.data?.message}</Trans>
                )}
              </small>
            </p>
            <DebugErrorDetails
              area="Device registration"
              state={
                displayedRegistrationError?.status === 409
                  ? "already-registered"
                  : "registration-error"
              }
              error={displayedRegistrationError}
              context={registrationDiagnostics}
              helpLink={
                <HelpLink
                  href={`${
                    import.meta.env.REACT_APP_SERVER_WEBSITE_URL
                  }/posts/reset-device#zurucksetzen-des-gerates`}
                />
              }
            />
          </InfoWrapper>
          <div className={styles.cancelButton}>
            {displayedRegistrationError?.status === 409 &&
            displayedRegistrationError?.data?.device?.id ? (
              <ButtonRouter
                withOrganization
                to={`/devices/${displayedRegistrationError?.data?.device?.id}`}
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
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === undefined ? (
        <>
          <InfoWrapper bottom={cancelButton} image={<InlineLoadingLarge />}>
            <p>
              <Trans>Waiting for device...</Trans>
            </p>
          </InfoWrapper>
        </>
      ) : displayedStep === "onboarding-wifi" ? (
        <BluetoothWifiProvisioning
          bottom={cancelButton}
          setAllowSubmit={setAllowSubmit}
          continueProcess={continueAfterWifiOnboarding}
          submitNewDigitalDevice={submitNewDigitalDevice}
          formValues={displayedFormValues}
          startTimer={startTimer}
          debugPreview={hasDebugState}
        />
      ) : displayedStep === "onboarding-sleep-error" ? (
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
            <DebugErrorDetails
              area="Device registration"
              state="device-sleeping"
              error={{
                message: "The device reported that it is sleeping",
                wifiStatus: displayedFormValues?.wifiStatus,
              }}
              context={registrationDiagnostics}
              helpLink={<HelpLink />}
            />
          </InfoWrapper>
        </>
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === "pending" ? (
        <>
          <InfoWrapper
            bottom={cancelButton}
            image={
              <EpaperFrame
                heading={<Trans>Activate device</Trans>}
                text={<Trans>Open the wirewire app and add the device</Trans>}
              />
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
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === "error" ? (
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
                {displayedResponse?.data?.message || "There was an error."}
              </Trans>
            </p>
            <DebugErrorDetails
              area="Device registration"
              state="activation-error"
              error={displayedResponse?.data}
              context={registrationDiagnostics}
              helpLink={<HelpLink />}
            />
          </InfoWrapper>
          <div className={styles.cancelButton}>
            <Button onClick={resetSingle} kind="tertiary">
              <Trans>Start again</Trans>
            </Button>
          </div>
        </>
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === "reset" ? (
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
            <DebugErrorDetails
              area="Device registration"
              state="activation-reset"
              error={displayedResponse?.data}
              context={registrationDiagnostics}
              helpLink={<HelpLink />}
            />
          </InfoWrapper>
          <div className={styles.cancelButton}>
            <Button onClick={resetSingle} kind="tertiary">
              <Trans>Start again</Trans>
            </Button>
          </div>
        </>
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === "device_confirmed" ? (
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
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === "timeout" ? (
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
            <DebugErrorDetails
              area="Device registration"
              state="activation-timeout"
              error={displayedResponse?.data}
              context={registrationDiagnostics}
              helpLink={<HelpLink />}
            />
          </InfoWrapper>
          <div className={styles.cancelButton}>
            <Button onClick={resetSingle} kind="tertiary">
              <Trans>Start again</Trans>
            </Button>
          </div>
        </>
      ) : displayedStep === "onboarding" &&
        displayedResponse?.data?.activation_status === "success" ? (
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
                      : displayedHasWifi
                      ? `/calendar/device/${displayedResponse?.data?.createdDevice?.id}`
                      : `/devices/${displayedResponse?.data?.createdDevice?.id}`
                  }
                >
                  {onboardingDialog ? (
                    <Trans>Continue</Trans>
                  ) : displayedHasWifi ? (
                    <Trans>Upload first image</Trans>
                  ) : (
                    <Trans>Go to device settings</Trans>
                  )}
                </ButtonRouter>
              </div>
            }
            className={styles.success}
            image={
              <EpaperFrame
                heading="Aktivierung abgeschlosen"
                text={<Trans>You can now upload your first image</Trans>}
                icon={faCheckCircle}
                kind="success"
              />
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
