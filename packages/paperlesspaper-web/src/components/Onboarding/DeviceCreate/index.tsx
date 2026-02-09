import React, { useEffect, useRef } from "react";
import LoginWrapper from "components/AuthWrapper";
import styles from "./device.module.scss";
import hospitalIllustration from "./device.svg";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import SettingsDevicesNew from "components/SettingsDevices/SettingsDevicesNew";
import useQs from "helpers/useQs";
import { useHistory, useLocation } from "react-router-dom";
const SettingsMobileHeader = () => null;

const SettingsContentHeader = () => null;

const Content = ({ children }: any) => (
  <div className={styles.deviceModal}>{children}</div>
);

const SidebarContentBody = ({ children }: any) => (
  <div className={styles.deviceModal}>{children}</div>
);

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
  const query = useQs();
  const queryRef = useRef(query);
  const { organization } = queryRef.current;

  useEffect(() => {
    const target = {
      pathname: location.pathname,
      hash: location.hash,
    };

    history.replace(target);
    history.push(target);
    history.replace(target);
  }, [history, location.hash, location.pathname]);

  return (
    <LoginWrapper
      // backLinkIconReverse={false}
      hideImageMobile
      backLink={false}
      rightSide={
        <img
          alt="Illustration of a hospital"
          className={styles.image}
          src={hospitalIllustration}
        />
      }
    >
      <SettingsDevicesNew
        onboardingDialog={`/onboarding/success?organization=${organization}`}
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
        to={`/onboarding/success?organization=${organization}`}
        /*onClick={() =>
          history.push(
            `/onboarding/success?organization=${currentQueryString.organization}`
          )
        }*/
      >
        <Trans>Skip for now</Trans>
      </ButtonRouter>
    </LoginWrapper>
  );
}
