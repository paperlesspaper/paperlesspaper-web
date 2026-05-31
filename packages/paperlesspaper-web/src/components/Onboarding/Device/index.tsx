import React from "react";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import styles from "./device.module.scss";
import { Button } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import SubmitWrapper from "components/SubmitWrapper";
import useQs from "helpers/useQs";
import QueryString from "qs";
import { organizationsApi } from "ducks/organizationsApi";
import { useHistory } from "react-router-dom";
import { usersApi } from "ducks/usersApi";
import deviceIllustration from "./deviceCreate.jpg";
import {
  buildOnboardingMeta,
  findReusableOnboardingOrganization,
} from "helpers/organizations/onboardingOrganization";

export default function Device() {
  const currentQueryString = useQs();
  const history = useHistory();

  const { t } = useTranslation();

  const [createSingleOrganization] =
    organizationsApi.useCreateSingleOrganizationsMutation();

  const [updateSingleOrganization] =
    organizationsApi.useUpdateSingleOrganizationsMutation();

  const allOrganizationsQuery = organizationsApi.useGetAllOrganizationsQuery();

  const [createSingleUser] = usersApi.useCreateSingleUsersMutation();

  const [updateSingleUser] = usersApi.useUpdateSingleUsersMutation();

  const [fetchCurrentUser] = usersApi.useLazyGetCurrentUserQuery();

  const createOrUpdateOnboardingUser = async (
    organizationId: string,
    existingUserId?: string,
  ) => {
    if (currentQueryString.firstName) {
      const values = {
        meta: {
          firstName: currentQueryString.firstName,
          lastName: currentQueryString.lastName,
        },
        role: currentQueryString.role,
      };

      if (existingUserId) {
        return updateSingleUser({
          id: existingUserId,
          values,
        });
      }

      return createSingleUser({
        values: {
          organization: organizationId,
          ...values,
        },
      });
    }

    if (currentQueryString.patient === "me") {
      const existingUser = await fetchCurrentUser(organizationId);
      return updateSingleUser({
        id: existingUser.data.id,
        values: { category: "relative" },
      });
    }

    return null;
  };

  const createOrganization = async ({ skip = false }: any) => {
    const allOrganizationsResult = await allOrganizationsQuery.refetch();
    const reusableOrganization = findReusableOnboardingOrganization(
      allOrganizationsResult.data || allOrganizationsQuery.data || [],
      currentQueryString,
    );

    let organization = reusableOrganization;

    if (!organization) {
      const result = await createSingleOrganization({
        values: {
          kind: currentQueryString.action,
        },
      });

      organization = result.data;
    }

    const existingUserId = organization.meta?.onboarding?.userId;
    const userResult = await createOrUpdateOnboardingUser(
      organization.id,
      existingUserId,
    );
    const userId = userResult?.data?.id || existingUserId;
    const onboardingStatus = skip ? "complete" : "device-pending";

    await updateSingleOrganization({
      id: organization.id,
      values: {
        kind: currentQueryString.action,
        meta: buildOnboardingMeta({
          status: onboardingStatus,
          query: currentQueryString,
          userId,
          existingMeta: organization.meta,
        }),
      },
    });

    history.push(
      `/onboarding/${skip ? "success" : "device-create"}?${QueryString.stringify(
        {
          organization: organization.id,
          user: userId,
          skip: skip ? "true" : undefined,
        },
      )}`,
    );
  };

  return (
    <LoginWrapper
      showBackLink
      backLinkText={<Trans>Back</Trans>}
      backLink={`/onboarding/?${QueryString.stringify(currentQueryString)}`}
      rightSide={
        <img
          alt="Illustration of a picture frame with a wifi symbol on it."
          className={styles.image}
          src={deviceIllustration}
        />
      }
    >
      <LoginWrapperTitle kind="small">
        <Trans>Connect device</Trans>
      </LoginWrapperTitle>

      <p className={styles.text}>
        {t("If you already have a device, you can set it up here.")}
      </p>

      <SubmitWrapper>
        <Button
          onClick={() => createOrganization({ skip: true })}
          large
          kind="tertiary"
        >
          <Trans>Skip step</Trans>
        </Button>

        <Button
          onClick={() => createOrganization({ skip: false })}
          large
          data-testId="connect-device-button"
        >
          <Trans>Connect device</Trans>
        </Button>
      </SubmitWrapper>
    </LoginWrapper>
  );
}
