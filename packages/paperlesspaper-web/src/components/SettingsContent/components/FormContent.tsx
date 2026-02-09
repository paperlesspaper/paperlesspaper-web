import React from "react";
import { Trans } from "react-i18next";
import { useSettingsContent } from "../SettingsContentContext";

export const FormContent = ({
  children,
  /*  handleSubmit,
  onSubmit,
  className,
  notification,
  formNotification,
  formClasses, *()
*/
}: any) => {
  const {
    //children,
    handleSubmit,
    onSubmit,
    className,
    notification,
    formRef,
    formNotification,
    formClasses,
  } = useSettingsContent();
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
        ref={formRef}
      >
        {notification}
        {formNotification}
        <div className={formClasses}>{children}</div>
      </form>
    );
  return <div className={className}>{children}</div>;
};
