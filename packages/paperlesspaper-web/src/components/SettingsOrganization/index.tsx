import React from "react";
import { BlockNotification, Callout, TextInput } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";

import useSettingsForm from "helpers/useSettingsFormNew";
import { SettingsSidebarNoSidebar } from "components/Settings/SettingsWithSidebar";
import styles from "./styles.module.scss";
import { useHistory } from "react-router";
import SettingsSubmitButton from "components/SettingsContent/components/SettingsSubmitButton";
import { organizationsApi } from "ducks/organizationsApi";
import useAccount from "helpers/useAccount";
import { useIsDesktop } from "@internetderdinge/web";
import DeviceIdFormatted from "components/SettingsDevices/DeviceIdFormatted";

export default function OrganizationPage() {
  const params = useParams();
  const history = useHistory();
  const account = useAccount();

  const store = useSettingsForm({
    //name: "organizations",
    api: organizationsApi,
    id: params.organization,
    //hideHeaderRight: true,
    customDeleteRedirect: () => {
      history.push("/?show=always&action=orgDeleted");
    },
    //url: `/${params.organization}/organization`,
    customOverviewUrl: `/${params.organization}/advanced`,
  });
  const isDesktop = useIsDesktop();

  const {
    entryData,
    form: { register },
  } = store;

  return (
    <SettingsSidebarNoSidebar
      {...store}
      name={entryData?.kind === "professional" ? "organizations" : "group"}
      sidebarBackButtonTitle="back"
      title={
        entryData?.kind === "professional" && !isDesktop ? (
          <Trans>Organization</Trans>
        ) : entryData?.kind === "professional" ? (
          <Trans>Organization settings</Trans>
        ) : (
          <Trans>Manage group</Trans>
        )
      }
      deleteValidationQuestionValue={entryData?.name}
      customDeleteQuestion={
        <Trans>Are you sure you want to delete this organization?</Trans>
      }
    >
      <>
        <TextInput
          formItemClassName={styles.name}
          labelText={
            entryData?.kind === "professional" ? (
              <Trans>Name of the organization</Trans>
            ) : (
              <Trans>Name of the group</Trans>
            )
          }
          {...register("name")}
        />
        <TextInput
          labelText={<Trans>Description</Trans>}
          {...register("meta.description")}
        />

        <Callout kind="info" title={<Trans>ID of the group</Trans>}>
          <Trans>The Group has the</Trans>{" "}
          <DeviceIdFormatted title={"ID:"} kind="objectId">
            {entryData?.id}
          </DeviceIdFormatted>
        </Callout>

        {account.isAdmin && (
          <>
            <BlockNotification
              kind="warning"
              title={<Trans>Admin setting</Trans>}
            >
              <Trans>Only admins can change the kind of organization</Trans>
            </BlockNotification>
            <TextInput
              labelText={<Trans>Kind of Organization (Admin)</Trans>}
              {...register("kind")}
            />
          </>
        )}
        {/*
        <h3>
          <Trans>Default intake times</Trans>
        </h3>

        <IntakeTimes control={control} register={register} watch={watch} /> */}
        {/*<SettingsSubmitButton
          {...store}
          name={entryData?.kind === "professional" ? "organizations" : "group"}
        /> */}
      </>
    </SettingsSidebarNoSidebar>
  );
}
