import React from "react";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import SettingsSubmitButton from "components/SettingsContent/components/SettingsSubmitButton";
import { messagesApi } from "ducks/messagesApi";
import JsonViewer from "components/JsonViewer";
import { iotDevicesApi } from "ducks/iotDevicesApi";

export default function IotDevicesDetails() {
  const store = useSettingsForm({
    api: iotDevicesApi,
    // url: `/${params.organization}/messages`,
  });

  const {
    entryData,
    // form: { control, register, watch },
  } = store;

  const [updateStatus] = messagesApi.useUpdateStatusMutation();
  console.log("iotDevicesApi", iotDevicesApi);

  const getShadowIotDevices = iotDevicesApi.useGetShadowIotDevicesQuery(
    {
      id: entryData?.serialNumber,
      shadowName: "settings",
    },
    { skip: !entryData?.serialNumber }
  );

  const getShadowIotDevicesAlarms = iotDevicesApi.useGetShadowIotDevicesQuery(
    {
      id: entryData?.serialNumber,
      shadowName: "alarm",
    },
    { skip: !entryData?.serialNumber }
  );

  return (
    <>
      <SettingsContentWrapper
        {...store}
        hideDelete
        title={
          entryData?.serialNumber
        } /*components={{ SettingsMobileHeader }}*/
      >
        <>
          <JsonViewer src={entryData} />

          <h3>Settings shadow</h3>

          <JsonViewer src={getShadowIotDevices?.data} />

          <h3>Alarm shadow</h3>

          <JsonViewer src={getShadowIotDevicesAlarms?.data} />

          <SettingsSubmitButton {...store} />
        </>
      </SettingsContentWrapper>
    </>
  );
}
