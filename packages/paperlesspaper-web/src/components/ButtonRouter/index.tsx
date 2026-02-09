import React from "react";
import { Button, NotificationActionButton } from "@progressiveui/react";
import { useParams, useHistory } from "react-router-dom";
import classnames from "classnames";
export default function ButtonRouter({
  to,
  isPlain,
  className,
  dataTestId,
  isLink,
  isHtmlLink,
  withOrganization,
  notification,
  onTouchStartHandler = true,
  ...other
}: any) {
  const history = useHistory();
  const { organization } = useParams();
  const toCalc =
    withOrganization && to?.pathname
      ? { ...to, pathname: `/${organization}${to.pathname}` }
      : withOrganization
        ? `/${organization}${to.pathname ? to.pathname : to}`
        : to;

  const ButtonComponent = notification ? NotificationActionButton : Button;

  if (isHtmlLink) {
    const linkClasses = classnames("wfp--link", className);

    return <a type="link" className={linkClasses} href={toCalc} {...other} />;
  }

  if (isPlain) {
    const linkClasses = classnames("wfp--link", className);

    return (
      <a
        type="link"
        className={linkClasses}
        href={toCalc}
        data-testid={dataTestId}
        onTouchStart={
          onTouchStartHandler
            ? (e) => {
                e.preventDefault();
                history.push(toCalc);
              }
            : undefined
        }
        onClick={(e) => {
          e.preventDefault();
          history.push(toCalc);
        }}
        {...other}
      />
    );
  }
  if (isLink) {
    return (
      <ButtonComponent
        type="link"
        data-testid={dataTestId}
        href={toCalc}
        /*onTouchStart={(e) => {
          e.preventDefault();
          history.push(toCalc);
        }}*/
        onClick={(e) => {
          e.preventDefault();
          history.push(toCalc);
        }}
        className={className}
        {...other}
      />
    );
  }
  return (
    <ButtonComponent
      data-testid={dataTestId}
      type="button"
      onClick={() => history.push(toCalc)}
      className={className}
      {...other}
    />
  );
}
