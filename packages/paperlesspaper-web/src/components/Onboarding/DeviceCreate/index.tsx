import React, { useEffect, useRef } from "react";
import deviceCreateIllustration from "./scan-qr-code-frame.jpg";
import LoginWrapper from "components/AuthWrapper";
import styles from "./device.module.scss";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import SettingsDevicesNew from "components/SettingsDevices/SettingsDevicesNew";
import useQs, { getQueryStringValue } from "helpers/useQs";
import { useHistory, useLocation, useParams } from "react-router-dom";
const SettingsMobileHeader = () => null;

const SettingsContentHeader = () => null;

const Content = ({ children }: any) => (
  <div className={styles.deviceModal}>{children}</div>
);

const SidebarContentBody = ({ children }: any) => (
  <div className={styles.deviceModal}>{children}</div>
);

type RegistrationContext = {
  patient?: string;
  user?: string;
  e2eSkipWifiProvisioning?: string;
};

type DeviceCreateLocationState = {
  onboardingRegistrationContext?: RegistrationContext;
};

const FormContent = ({
  children,
  handleSubmit,
  onSubmit,
  className,
  notification,
  formNotification,
  formClasses,
}: any) => {
  const checkKeyDown = (e) => {
    if (e.code === "Enter") e.preventDefault();
  };
  if (handleSubmit && onSubmit)
    return (
      <form
        className={className}
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => checkKeyDown(e)}
        id="settings-form"
      >
        {notification}
        {formNotification}
        <div className={formClasses}>{children}</div>
      </form>
    );
  return <div className={className}>{children}</div>;
};

export default function DeviceCreate() {
  const history = useHistory();
  const location = useLocation();
  const { organization } = useParams<{ organization: string }>();
  const query = useQs();
  const registrationContextFromState = (
    location.state as DeviceCreateLocationState | undefined
  )?.onboardingRegistrationContext;
  const registrationContextRef = useRef<RegistrationContext>({
    patient:
      getQueryStringValue(query.patient) ??
      registrationContextFromState?.patient,
    user: getQueryStringValue(query.user) ?? registrationContextFromState?.user,
    e2eSkipWifiProvisioning:
      getQueryStringValue(query.e2eSkipWifiProvisioning) ??
      registrationContextFromState?.e2eSkipWifiProvisioning,
  });
  const registrationContext = registrationContextRef.current;
  const successPath = `/${organization}/onboarding/success`;

  useEffect(() => {
    const target = {
      pathname: location.pathname,
      hash: location.hash,
      state: {
        onboardingRegistrationContext: registrationContext,
      },
    };

    history.replace(target);
    history.push(target);
    history.replace(target);
  }, [history, location.hash, location.pathname, registrationContext]);

  return (
    <LoginWrapper
      hideImageMobile
      backLink={false}
      rightSide={
        <img
          alt="Illustration of a picture frame with a wifi symbol on it."
          className={styles.image}
          src={deviceCreateIllustration}
        />
      }
    >
      <SettingsDevicesNew
        allowScroll
        registrationContext={registrationContext}
        onboardingDialog={successPath}
        components={{
          SettingsMobileHeader,
          SettingsContentHeader,
          FormContent,
          Content,
          SidebarContentBody,
        }}
      />
      <ButtonRouter
        isPlain
        className={styles.skipButton}
        to={`${successPath}?skip=true`}
      >
        <Trans>Skip for now</Trans>
      </ButtonRouter>
    </LoginWrapper>
  );
}
