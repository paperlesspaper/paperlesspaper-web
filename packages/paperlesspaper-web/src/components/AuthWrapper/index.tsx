import React from "react";

import styles from "./auth-wrapper.module.scss";
import { useIsDesktop } from "@internetderdinge/web";
import { useHistory, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/pro-solid-svg-icons";
import classnames from "classnames";
import ButtonRouter from "components/ButtonRouter";
import MobileStatusOverlay from "components/MobileTopOverlay";

interface AuthWrapperProps {
  children: React.ReactNode;
  logo?: React.ReactNode;
  rightSide?: React.ReactNode;
  customBack?: any;
  showBackLink?: boolean;
  backLinkText?: React.ReactNode;
  backLink?: string | boolean;
  onClick?: () => void;
  hideImageMobile?: boolean;
  hideContentMobile?: boolean;
  backLinkIconReverse?: boolean;
  width?: number;
}

const AuthWrapper = ({
  children,
  logo,
  rightSide,
  customBack,
  showBackLink,
  backLinkText,
  backLink,
  hideContentMobile,
  hideImageMobile,
  backLinkIconReverse = true,
  width,
}: AuthWrapperProps) => {
  const location = useLocation();
  const history = useHistory();
  const isDesktop = useIsDesktop();

  const classes = classnames(
    {
      [styles.loginHideContentMobile]: hideContentMobile === true,
      [styles.hideImageMobile]: hideImageMobile,
      [styles.rightSide]: rightSide,
      [styles.notRightSide]: !rightSide,
    },
    styles.login
  );

  const props: any = {
    icon: <FontAwesomeIcon icon={faChevronLeft} />,
    iconReverse: backLinkIconReverse,
    kind: isDesktop ? "tertiary" : undefined,
    className: styles.backLink,
    to: { pathname: backLink, state: { prevPath: location.pathname } },
  };

  if (location.backOption === "detailPage") {
    props.onClick = () => history.goBack();
  }

  /*{location.backOption === "detailPage" ? (
    <span to={`${overviewUrl}`} onClick={() => history.goBack()}>
      <SidebarBackButton />
    </span>
  ) : (*/

  const backLinkElement = customBack ? (
    customBack(props)
  ) : (
    <ButtonRouter {...props} kind="tertiary">
      {backLinkText ? backLinkText : "Back to login"}
    </ButtonRouter>
  );

  return (
    <div id="auth-wrapper-scroll" className={classes}>
      <MobileStatusOverlay kind={rightSide ? "blue" : "background"} />
      <section
        className={styles.loginForm}
        style={{ width: width ? `${width}vw` : undefined }}
      >
        <div className={styles.loginLogo}>{logo}</div>

        {showBackLink && backLinkElement}
        <div className={styles.loginFormContent}>{children}</div>
      </section>
      {rightSide && (
        <section
          className={styles.loginContent}
          style={{ width: width ? `${100 - width}vw` : undefined }}
        >
          {/*showBackLink && backLinkElement*/}
          {rightSide}
        </section>
      )}
    </div>
  );
};

export default AuthWrapper;

export function LoginWrapperTitle({ kind, ...other }: any) {
  const classes = classnames(styles.loginWrapperTitle, {
    [styles.loginWrapperTitleSmall]: kind === "small",
  });

  return <h4 className={classes} {...other} />;
}
