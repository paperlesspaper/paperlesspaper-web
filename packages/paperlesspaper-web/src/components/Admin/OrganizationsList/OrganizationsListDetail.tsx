import React, { useEffect } from "react";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { messagesApi } from "ducks/messagesApi";
import { organizationsApi } from "ducks/organizationsApi";
import ButtonRouter from "components/ButtonRouter";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import { usersApi } from "ducks/usersApi";
import { useParams } from "react-router-dom";
import { devicesApi } from "ducks/devices";
import JsonViewer from "components/JsonViewer";
import { Trans } from "react-i18next";

export default function SettingsNotificationsDetail() {
  const store = useSettingsForm({
    api: organizationsApi,
    // url: `/${params.organization}/messages`,
  });

  const { entryData } = store;

  const [updateStatus /* updateStatusResult */] =
    messagesApi.useUpdateStatusMutation();

  useEffect(() => {
    if (entryData?.id && entryData.result?.status !== "read")
      updateStatus({ id: entryData.id, data: { status: "read" } });
  }, [entryData?.id]);

  const { entry } = useParams();
  const { data: usersData } = usersApi.useGetAllUsersQuery({
    organizationId: entry,
  });

  const { data: devicesData } = devicesApi.useGetAllDevicesQuery(
    {
      organizationId: entry,
    },
    { skip: !entry }
  );

  return (
    <SettingsContentWrapper
      {...store}
      hideDelete
      title={
        <>
          <Trans>Organization</Trans> {entryData?.name}
        </>
      } /*components={{ SettingsMobileHeader }}*/
    >
      <ButtonRouter
        isLink
        to={`/${entryData?.id}`}
        icon={<FontAwesomeIcon icon={faChevronRight} />}
      >
        <Trans>Visit organization</Trans>
      </ButtonRouter>
      <br />

      <JsonViewer src={entryData} />

      <h3>
        {usersData && usersData.length} <Trans>Users</Trans>
      </h3>
      <JsonViewer src={usersData} collapsed />

      <h3>
        {devicesData && devicesData.length} <Trans>Devices</Trans>
      </h3>

      <JsonViewer src={devicesData} collapsed />
    </SettingsContentWrapper>
  );
}
