import React, { useEffect } from "react";
import { Prompt, useHistory } from "react-router-dom";
import SettingsContentHeader from "./components/SettingsContentHeader";
import styles from "./styles.module.scss";
import {
  BlockNotification,
  SidebarContentBody,
  List,
  ListItem,
} from "@progressiveui/react";
import SettingsMobileHeader from "./components/SettingsMobileHeader";
import i18next from "i18next";
import { Trans } from "react-i18next";
import classnames from "classnames";
import qs from "qs";
import { scrollToTop } from "@internetderdinge/web";
import ErrorNotice from "components/Status/ErrorNotice";
import { useDebug } from "helpers/useCurrentUser";
import JsonViewer from "components/JsonViewer";
import { SettingsContentProvider } from "./SettingsContentContext";
import { NewEntrySuccess } from "./components/NewEntrySuccess";
import { UpdateEntrySuccess } from "./components/UpdateEntrySuccess";
import { EntryName } from "./components/EntryName";
import { Content } from "./components/Content";
import { FormContent } from "./components/FormContent";
import { AfterContent } from "./components/AfterContent";
import { DeleteButtonWrapper } from "./components/DeleteButtonWrapper";
import SettingsSubmitButton from "./components/SettingsSubmitButton";

const SettingsContentWrapper = (props: any) => {
  // add a class on mount, remove on unmount
  useEffect(() => {
    if (!props.global && !props.allowScroll)
      document.body.classList.add("disable-scroll");
    return () => {
      document.body.classList.remove("disable-scroll");
    };
  }, []);

  const {
    children,
    disableClosePrompt,
    components: componentsOverride = {},
    handleSubmit,
    customRedirectAfterSubmit,
    onSubmit,
    idElement,
    StatusBlockquote,
    fullWidth,
    fullHeight,
    search,
    hideMessages,
    form = { formState: {} },
    singleQuery,
    showReturnDesktop = false,
    isDirtyAlt,
    resultCreateSingle,
    resultUpdateSingle,
    latestCrudId,
    entryDataId,
    urlId,
    url,
    wrapperClasses,
    ...other
  } = props;

  const defaultComponents = {
    SettingsMobileHeader,
    SettingsContentHeader,
    StatusBlockquote,
    DeleteButtonWrapper,
    SidebarContentBody,
    NewEntrySuccess,
    UpdateEntrySuccess,
    SettingsSubmitButton,
    EntryName,
    Content,
    FormContent,
    AfterContent,
  };
  const components = { ...defaultComponents, ...componentsOverride };
  const isDebug = useDebug();

  const history = useHistory();
  const updateName = props.entryName
    ? props.entryName(
        other.latestCrudUpdate ||
          resultCreateSingle?.data ||
          resultUpdateSingle?.data,
      )
    : "";

  console.log("SettingsContentWrapper props", props);

  const classes = classnames(
    styles.regularForm,
    {
      [`${styles.narrow}`]: other.narrow,
      [`${styles.fullWidth}`]: fullWidth,
      [`${styles.fullHeight}`]: fullHeight,
      [`${styles.global}`]: other.global,
    },
    wrapperClasses,
  );

  useEffect(() => {
    if (resultCreateSingle?.isSuccess) {
      reset(undefined, { keepValues: true, dirty: false });
    }
    if (resultCreateSingle?.isSuccess || resultCreateSingle?.isError)
      scrollToTop();
  }, [resultCreateSingle]);

  useEffect(() => {
    if (resultUpdateSingle?.isSuccess) {
      reset(undefined, { keepValues: true, dirty: false });
    }
    if (resultUpdateSingle?.isSuccess || resultUpdateSingle?.isError)
      scrollToTop();
  }, [resultUpdateSingle]);

  const notification = hideMessages ? null : resultCreateSingle?.isSuccess &&
    idElement(resultCreateSingle.data) === urlId ? (
    <BlockNotification
      kind="success"
      icon
      title={
        <>
          <Trans>{other.name + "-SINGULAR"}</Trans> <Trans>created</Trans>
        </>
      }
      subtitle={
        <components.NewEntrySuccess
          entryData={other.entryData}
          entryName={updateName}
          components={components}
          defaultComponents={defaultComponents}
        />
      }
      className={styles.infoBlockquote}
    />
  ) : (latestCrudId === entryDataId && entryDataId) ||
    (resultUpdateSingle?.isSuccess &&
      idElement(resultUpdateSingle?.data) === urlId) ? (
    <BlockNotification
      kind="success"
      icon
      title={
        <>
          <Trans>{other.name + "-SINGULAR"}</Trans> <Trans>updated</Trans>
        </>
      }
      subtitle={
        <components.UpdateEntrySuccess
          entryData={other.entryData}
          entryName={updateName}
          components={components}
          defaultComponents={defaultComponents}
        />
      }
      className={styles.infoBlockquote}
    />
  ) : resultCreateSingle?.isError || other.error ? (
    <BlockNotification
      kind="warning"
      title={<Trans>Creating failed</Trans>}
      subtitle={
        <>
          <Trans>
            {resultCreateSingle.error?.data?.message ||
              "Error while creating a new entry."}
          </Trans>

          {isDebug && <JsonViewer collapsed src={resultCreateSingle} />}
        </>
      }
    />
  ) : resultUpdateSingle?.isError ? (
    <BlockNotification
      kind="warning"
      title={<Trans>Updating failed</Trans>}
      subtitle={
        <>
          <Trans>There was an error while updating the entry.</Trans>
          {resultUpdateSingle.error?.data?.message && (
            <>
              <br />
              <Trans>{resultUpdateSingle.error.data?.message}</Trans>
            </>
          )}

          {isDebug && <JsonViewer collapsed src={resultUpdateSingle} />}
        </>
      }
    />
  ) : singleQuery?.isError ? (
    <ErrorNotice query={singleQuery} className={styles.errorNotice} />
  ) : null;

  const {
    formState: { errors },
    reset,
  } = form;

  const errorsArray = errors ? Object.entries(errors) : [];

  const formNotification =
    errorsArray.length > 0 ? (
      <BlockNotification
        kind="warning"
        title={<Trans>Error occured</Trans>}
        subtitle={
          <>
            <Trans>There was an error while loading the entry.</Trans>
            <List kind="simple">
              {errorsArray.map(([i, e]: any) => (
                <ListItem key={i} title={<Trans>{i}</Trans>}>
                  {<Trans>{e.message}</Trans>}
                </ListItem>
              ))}
            </List>
          </>
        }
      />
    ) : null;

  const formClasses = classnames(styles.formWrapper, {
    [`${styles.isLoading}`]:
      singleQuery?.isLoading /*|| singleQuery?.isFetching*/, // TODO: if this is enough for loading
    [`${styles.error}`]: singleQuery?.error,
  });

  const formElClasses = classnames(styles.form, {
    [`${styles.fullHeight}`]: fullHeight,
  });

  useEffect(() => {
    //scrollToTop();
    if (resultCreateSingle?.data?.id && urlId === "new") {
      if (customRedirectAfterSubmit) {
        customRedirectAfterSubmit({
          ...props,
          resultCreateSingle,
          action: "create",
        });
      } else {
        history.push(
          `${url}/${resultCreateSingle.data?.id}?${qs.stringify({
            ...search,
          })}`,
        );
      }
    }
  }, [resultCreateSingle]);

  useEffect(() => {
    if (customRedirectAfterSubmit) {
      customRedirectAfterSubmit({
        ...props,
        resultCreateSingle,
        action: "update",
      });
    }
  }, [resultUpdateSingle]);

  const content = (
    <components.Content>
      <components.SettingsContentHeader components={components} />
      {components.StatusBlockquote && <components.StatusBlockquote />}
      <components.FormContent
        className={formElClasses}
        formClasses={formClasses}
        onSubmit={onSubmit}
        handleSubmit={handleSubmit}
        notification={notification}
        formNotification={formNotification}
      >
        {children}
      </components.FormContent>
      <components.DeleteButtonWrapper />

      <components.AfterContent />
    </components.Content>
  );

  const context = {
    ...props,
    components,
    handleSubmit,
    onSubmit,
    customRedirectAfterSubmit,
    formNotification,
    notification,
    formClasses,
    formElClasses,
    classes,
    errors,
    reset,
    isDirtyAlt,
    idElement,
    StatusBlockquote,
    showReturnDesktop,
    fullHeight,
    fullWidth,
    search,
    disableClosePrompt,
    disableDelete: other.disableDelete,
    latestCrudId,
    entryDataId,
  };

  console.log("SettingsContentWrapper context", context);
  return (
    <SettingsContentProvider value={context}>
      <Prompt
        when={
          !disableClosePrompt &&
          isDirtyAlt === true &&
          !(resultCreateSingle?.data?.id && urlId === "new")
        }
        message={() => i18next.t(`Are you sure you want to go to?`)}
      />

      {other.global ? (
        <>{content}</>
      ) : (
        <>
          <components.SettingsMobileHeader components={components} />
          <components.SidebarContentBody>
            {content}
          </components.SidebarContentBody>
        </>
      )}
    </SettingsContentProvider>
  );
};

export default SettingsContentWrapper;
