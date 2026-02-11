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

export default function Device() {
  const currentQueryString = useQs();
  const history = useHistory();

  const { t } = useTranslation();

  const [createSingleOrganization, createSingleOrganizationResult] =
    organizationsApi.useCreateSingleOrganizationsMutation();

  const [createSingleUser, createSingleUserResult] =
    usersApi.useCreateSingleUsersMutation();

  const [updateSingleUser, updateSingleUserResult] =
    usersApi.useUpdateSingleUsersMutation();

  const [fetchCurrentUser, fetchCurrentUserResult] =
    usersApi.useLazyGetCurrentUserQuery();

  const createOrganization = async ({ skip = false }: any) => {
    const result = await createSingleOrganization({
      values: {
        kind: currentQueryString.action,
      },
    });

    let userResult = null;

    if (currentQueryString.firstName) {
      userResult = await createSingleUser({
        values: {
          organization: result.data.id,
          meta: {
            firstName: currentQueryString.firstName,
            lastName: currentQueryString.lastName,
          },
          role: currentQueryString.role,
        },
      });
    } else if (currentQueryString.patient === "me") {
      const existingUser = await fetchCurrentUser(result.data.id);
      userResult = await updateSingleUser({
        id: existingUser.data.id,
        values: { category: "relative" },
      });
    }

    history.push(
      `/onboarding/${skip ? "success" : "device-create"}?organization=${
        result.data.id
      }&user=${userResult.data.id}`,
    );
  };

  return (
    <LoginWrapper
      showBackLink
      backLinkText={<Trans>Back</Trans>}
      backLink={`/onboarding/?${QueryString.stringify(currentQueryString)}`}
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
