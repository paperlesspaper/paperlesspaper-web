import React from "react";
import { Trans } from "react-i18next";

export default function OrganizationName({ organization }: any) {
  return (
    <>
      {organization.name ? (
        organization.name
      ) : organization.kind === "private" ? (
        <Trans>Private organization</Trans>
      ) : organization.kind === "professional" ? (
        <Trans>Professional organization</Trans>
      ) : (
        <Trans>Unnamed group</Trans>
      )}
    </>
  );
}
