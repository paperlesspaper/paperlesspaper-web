import React, { useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import { BlockNotification, InlineLoading, Link } from "@progressiveui/react";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsSubmitButton from "components/SettingsContent/components/SettingsSubmitButton";
import { Trans } from "react-i18next";
import SubmitWrapper from "components/SubmitWrapper";
import { usersApi } from "ducks/usersApi";
import ButtonRouter from "components/ButtonRouter";
import useAccount from "helpers/useAccount";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";

export default function ReviewInvite() {
  const { organization, token } = useParams();

  const account = useAccount();
  const { logout } = account;

  const submitAcceptInvite = () => {
    updateInvite({
      values: { organization, inviteCode: token, status: "accepted" },
    });
  };

  const store = useSettingsForm({
    api: usersApi,
    url: `/acceptInvite`,
    //hideTitle: true,
    //hideHeaderRight: true,
    customSubmit: submitAcceptInvite,
    //preventRedirect: true,
    newEntryData: { action: "private" },
    customOverviewUrl: "/",
  });

  const { handleSubmit, onSubmit, resultCreateSingle, regularFormStyle } =
    store;

  const history = useHistory();
  //const currentOrganization = useCurrentOrganization();

  useEffect(() => {
    if (resultCreateSingle.data) {
      history.push(
        `/${organization}/invite/device?patient=${resultCreateSingle.data.id}`,
      );
    }
  }, [resultCreateSingle.isSuccess]);

  const invite = usersApi.useGetInviteQuery({
    token: token,
  });

  const [updateInvite, resultUpdateInvite] = usersApi.useUpdateInviteMutation();

  useEffect(() => {
    if (resultUpdateInvite.data) {
      history.push(`/${organization}/`);
    }
  }, [resultUpdateInvite.isSuccess]);

  return (
    <SettingsContentWrapper
      {...store}
      sidebarBackButtonTitle={<Trans>Overview</Trans>}
      submitButtonTitle={<Trans>Accept Invitation</Trans>}
      mobileSubmitButtonTitle={<Trans>Accept</Trans>}
      showReturnDesktop
      className={styles.inviteWrapper}
      hideSubmitButton={invite?.error?.status === 409}
      title={
        invite?.error?.status === 409 ? (
          <Trans>Already member</Trans>
        ) : (
          <Trans>Invitation</Trans>
        )
      }
    >
      <div className={regularFormStyle}>
        {invite?.error?.status === 409 ? (
          <form>
            <p className={styles.text}>
              <Trans>
                You are already a member of this group. Please ensure you are
                logged in with the correct user account.
              </Trans>{" "}
              <b>{invite?.data?.organizationData?.name}</b>
            </p>

            <SubmitWrapper>
              <Link className={styles.next} onClick={() => logout()}>
                <Trans>Logout</Trans>
              </Link>
              <SettingsSubmitButton
                large
                {...store}
                href="/"
                //wrapper="inline"

                icon={<FontAwesomeIcon icon={faChevronRight} />}
                title={<Trans>Continue</Trans>}
              />
            </SubmitWrapper>
          </form>
        ) : invite?.error?.status ? (
          <BlockNotification
            title={<Trans>Error occured</Trans>}
            kind="error"
            actions={
              <ButtonRouter to="/" kind="danger--primary">
                <Trans>Continue</Trans>
              </ButtonRouter>
            }
          >
            <Trans>No invite found. Please ask for a new invite.</Trans>
          </BlockNotification>
        ) : invite.isSuccess ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <p className={styles.text}>
              <Trans>You where invited to join the group:</Trans>{" "}
              <b>{invite?.data?.organizationData?.name}</b>
            </p>

            <SubmitWrapper>
              <Link href="/" className={styles.next}>
                <Trans>Ignore</Trans>
              </Link>
              {/* <SettingsSubmitButton
                large
                {...store}
                //wrapper="inline"

                icon={<FontAwesomeIcon icon={faChevronRight} />}
                title={<Trans>Accept</Trans>}
              />*/}
            </SubmitWrapper>
          </form>
        ) : (
          <InlineLoading description={<Trans>Loading...</Trans>} />
        )}
      </div>
    </SettingsContentWrapper>
  );
}
