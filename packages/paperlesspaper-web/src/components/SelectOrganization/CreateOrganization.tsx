import React from "react";
import { useHistory, useParams } from "react-router-dom";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import styles from "./createOrganization.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsSubmitButton from "components/SettingsContent/components/SettingsSubmitButton";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import { organizationsApi } from "ducks/organizationsApi";

export default function CreateOrganization() {
  const prepareSubmit = (values) => {
    const { action, ...other } = values;
    return { ...other, kind: action };
  };
  const store = useSettingsForm({
    api: organizationsApi,
    url: `/createOrganization`,
    //hideTitle: true,
    //hideHeaderRight: true,
    prepareSubmit,
    //preventRedirect: true,
    newEntryData: { action: "private-wirewire" },
  });

  const {
    entryData,
    handleSubmit,
    onSubmit,
    resultCreateSingle,
    search,
    regularFormStyle,
  } = store;

  const history = useHistory();

  const { detail } = useParams();

  if (resultCreateSingle.data) {
    history.push(
      `/${resultCreateSingle.data?.id}/onboarding/device/?show=always`,
    );
  }

  return (
    <>
      <LoginWrapper
        showBackLink
        backLink="/?show=always"
        backLinkText={<Trans>Overview</Trans>}
        //hideContentMobile
        rightSide={<div className={styles.loginContent}></div>}
      >
        <LoginWrapperTitle kind="small">
          {search.urlId !== "new" && detail === "first" ? (
            <Trans>Welcome!</Trans>
          ) : search.urlId !== "new" ? (
            <Trans>Create new group</Trans>
          ) : (
            <Trans>Organization successfully created!</Trans>
          )}
        </LoginWrapperTitle>

        <div className={regularFormStyle}>
          {/*submitSuccess === true && <Redirect to="/" />*/}
          <form onSubmit={handleSubmit(onSubmit)}>
            {search.urlId === "new" ? (
              <>
                <ButtonRouter
                  isLink
                  to={`/${entryData?.id}`}
                  icon={<FontAwesomeIcon icon={faChevronRight} />}
                >
                  Visit {entryData?.name} organization
                </ButtonRouter>
              </>
            ) : (
              <>
                <p className={styles.setupText}>
                  <Trans>
                    The setup wizard helps you to set up your first device.
                  </Trans>
                </p>
                <SettingsSubmitButton
                  {...store}
                  icon={<FontAwesomeIcon icon={faChevronRight} />}
                  title={<Trans>Continue</Trans>}
                />
              </>
            )}
          </form>
        </div>
      </LoginWrapper>
    </>
  );
}
