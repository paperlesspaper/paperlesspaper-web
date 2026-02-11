import React from "react";
import { useHistory } from "react-router-dom";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import styles from "./createOrganization.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import useSettingsForm from "helpers/useSettingsFormNew";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import { organizationsApi } from "ducks/organizationsApi";
import QueryString from "qs";
import useQs from "helpers/useQs";
import SubmitWrapper from "components/SubmitWrapper";

export default function CreateOrganization() {
  const currentQueryString = useQs();
  const prepareSubmit = (values) => {
    return values;
  };

  const history = useHistory();

  const customSubmit = (values) => {
    const valuesString = QueryString.stringify({ ...values, show: "always" });

    history.push(`/onboarding/device/?${valuesString}`);
  };

  const allQuery = organizationsApi.useGetAllOrganizationsQuery();

  const store = useSettingsForm({
    api: organizationsApi,
    url: `/createOrganization`,
    prepareSubmit,
    customSubmit,
    prepareFormEntry: () => {
      return {
        action: "private-wirewire",
        ...currentQueryString,
      };
    },
    newEntryData: { action: "private-wirewire" },
  });

  const { entryData, handleSubmit, onSubmit, search, regularFormStyle } = store;

  const { detail } = currentQueryString;

  const hasOverview = allQuery.data?.length > 0;

  return (
    <>
      <LoginWrapper
        showBackLink
        backLink={hasOverview ? "/?show=always" : "/account"}
        backLinkText={
          hasOverview ? <Trans>Overview</Trans> : <Trans>Account</Trans>
        }
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
          <form onSubmit={handleSubmit(onSubmit)} id="settings-form">
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
                </p>{" "}
                {/*} <SubmitWrapper>
                        <ButtonRouter
                          large
                          id="continueSuccessButton"
                          to={`/${organization}/calendar`}
                          icon={<FontAwesomeIcon icon={faChevronRight} />}
                        >
                          <Trans>Go to overview</Trans>
                        </ButtonRouter>
                      </SubmitWrapper> */}
                <SubmitWrapper>
                  <ButtonRouter
                    large
                    id="continueSuccessButton"
                    type="submit"
                    icon={<FontAwesomeIcon icon={faChevronRight} />}
                  >
                    <Trans>Continue</Trans>
                  </ButtonRouter>
                </SubmitWrapper>
              </>
            )}
          </form>
        </div>
      </LoginWrapper>
    </>
  );
}
