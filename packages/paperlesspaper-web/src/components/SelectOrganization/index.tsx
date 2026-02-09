import Repeater from "components/Repeater";
import React from "react";
import { NavLink, useHistory, useLocation } from "react-router-dom";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import styles from "./styles.module.scss";
import {
  BlockNotification,
  InlineLoading,
  Item,
  Loading,
} from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClinicMedical, faUsers } from "@fortawesome/pro-regular-svg-icons";
import ButtonRouter from "components/ButtonRouter";
import qs from "qs";
import { Trans } from "react-i18next";
import OrganizationName from "components/OrganizationName";
import {
  faChevronRight,
  faFamily,
  faUser,
} from "@fortawesome/pro-solid-svg-icons";
import { organizationsApi } from "ducks/organizationsApi";
import Status from "components/Status";
import HelmetTitle from "components/HelmetMeta/HelmetTitle";
import LoginImage from "components/Login/LoginImage";
import { isAppWirewire } from "helpers/useAppIdentifier";

export default function SelectOrganization() {
  const history = useHistory();

  const location = useLocation();
  const { show, action } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });

  const allQuery = organizationsApi.useGetAllOrganizationsQuery();
  const { data = [] } = allQuery;

  if (data.length === 1 && show !== "always") {
    history.push(`./${data[0].id}`);
  }

  if (data.length === 0 && allQuery.isSuccess === true && show !== "always") {
    history.push(`/onboarding/?detail=first`);
  }

  const dataFiltered = data; //.filter((e) => e.kind === "private-wirewire");

  return (
    <LoginWrapper
      showBackLink
      // hideImageMobile
      customBack={(props) => (
        <ButtonRouter
          {...props}
          icon={<FontAwesomeIcon icon={faUser} />}
          iconReverse={false}
          to="/account"
        >
          <Trans>Account</Trans>
        </ButtonRouter>
      )}
      rightSide={<LoginImage />}
    >
      <HelmetTitle>Select group</HelmetTitle>
      <Status query={allQuery} forceDebug components={{ Loading }}>
        {data.length === 0 ? (
          <>
            <BlockNotification
              title={<Trans>Get started</Trans>}
              lowContrast
              kind="info"
              className={styles.getStarted}
              subtitle={
                <Trans>Create a group or get invited by another user.</Trans>
              }
              hideCloseButton
            ></BlockNotification>
            <ButtonRouter
              to="/onboarding"
              icon={<FontAwesomeIcon icon={faChevronRight} />}
              large
            >
              <Trans>Create group</Trans>
            </ButtonRouter>
          </>
        ) : (
          <>
            <LoginWrapperTitle id="select-organization-title">
              <Trans>Your groups</Trans>
            </LoginWrapperTitle>

            {action === "orgDeleted" && (
              <BlockNotification
                className={styles.deleteOrg}
                title={<Trans>Group deleted</Trans>}
                lowContrast
                kind="info"
                subtitle={<Trans>The group was successfully deleted</Trans>}
                hideCloseButton
              ></BlockNotification>
            )}
            {data && (
              <Repeater
                addButtonText={
                  isAppWirewire() ? (
                    <Trans>New group</Trans>
                  ) : (
                    <Trans>Create new group</Trans>
                  )
                }
                addButtonTo="/onboarding"
                addButtonAddition={
                  allQuery.isLoading ? (
                    <InlineLoading description="Loading..." />
                  ) : undefined
                }
              >
                {dataFiltered.map((e) => (
                  <NavLink to={`${e.id}`} key={e.id}>
                    <Item
                      image={
                        <FontAwesomeIcon
                          icon={
                            e.kind === "private"
                              ? faUsers
                              : e.kind === "professional"
                                ? faClinicMedical
                                : faFamily
                          }
                          className={styles.icon}
                        />
                      }
                      title={<OrganizationName organization={e} />}
                      kind="horizontal"
                      wrapper="repeater"
                    >
                      {e.meta?.description ? (
                        e.meta.description
                      ) : e.kind === "private" ? (
                        <Trans>Private Group</Trans>
                      ) : e.kind === "professional" ? (
                        <Trans>Professional Organization</Trans>
                      ) : e.kind === "private-wirewire" ? (
                        <Trans>Private Group</Trans>
                      ) : null}
                    </Item>
                  </NavLink>
                ))}
              </Repeater>
            )}
          </>
        )}
      </Status>
      <br />
      {/*<InlineNotification
        kind="warning"
        title="Anmed Smart Alpha. 0.7"
        //actions={<NotificationActionButton>Action</NotificationActionButton>}
        iconDescription="describes the close button"
        kind="warning"
        lowContrast
        statusIconDescription="describes the status icon"
        subtitle="nur für Testzwecke"
        hideCloseButton
      >
        <p>nur für Testzwecke</p>
      </InlineNotification>*/}
    </LoginWrapper>
  );
}
