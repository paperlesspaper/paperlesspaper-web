import React from "react";
import { Button, InlineLoading } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faSatelliteDish,
  faTrashUndo,
} from "@fortawesome/pro-solid-svg-icons";
import { devicesApi } from "ducks/devices";
import JsonViewer from "components/JsonViewer";
import { Trans } from "react-i18next";

export default function PingDevice({ id }: any) {
  const [pingDevice, resultPingDevice] =
    devicesApi.useUpdatePindByDeviceIdMutation();
  const [rebootDevice, resultRebootDevice] =
    devicesApi.useRebootDeviceMutation();

  const [resetDevice, resultResetDevice] = devicesApi.useResetDeviceMutation();

  /*const [getDeviceStatus, resultGetDeviceStatus] =
    devicesApi.useGetDeviceStatusMutation();*/

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data } = devicesApi.useGetSingleDevicesQuery(id, {
    skip: id === undefined,
  });

  return (
    <>
      <h3>
        <Trans>Ping device</Trans>
      </h3>
      <p>
        <Trans>
          Ping the device to see if it is online and make it available for
          faster responses.
        </Trans>
      </p>
      <br />
      <Button
        icon={<FontAwesomeIcon icon={faSatelliteDish} />}
        onClick={() =>
          pingDevice({
            id,
            data: { dataResponse: true },
          })
        }
      >
        <Trans>Ping device</Trans>
      </Button>{" "}
      <br />
      {resultPingDevice.isLoading && (
        <InlineLoading description={<Trans>Ping device...</Trans>} />
      )}
      {resultPingDevice?.data && <JsonViewer src={resultPingDevice.data} />}
      <h3>
        <Trans>Reboot device</Trans>
      </h3>
      <p>
        <Trans>Reboot the devices firmware.</Trans>
      </p>
      <br />
      <Button
        icon={<FontAwesomeIcon icon={faTrashUndo} />}
        onClick={() => rebootDevice(id)}
      >
        <Trans>Reboot device</Trans>
      </Button>
      {resultRebootDevice.isLoading && (
        <InlineLoading description={<Trans>Reboot device...</Trans>} />
      )}
      {resultRebootDevice?.data && <JsonViewer src={resultRebootDevice.data} />}
      <h3>
        <Trans>Reset device</Trans>
      </h3>
      <p>
        <Trans>Reset all variables, memory and reboot the device.</Trans>
      </p>
      <br />
      <Button
        icon={<FontAwesomeIcon icon={faArrowsRotate} />}
        onClick={() => resetDevice(id)}
      >
        <Trans>Reset device</Trans>
      </Button>
      {resultResetDevice.isLoading && (
        <InlineLoading description={<Trans>Reset device...</Trans>} />
      )}
      {resultResetDevice?.data && <JsonViewer src={resultResetDevice.data} />}
      {/*<h3>Get device Status</h3>
      <p>Whattt????</p>
      <br />
      <Button
        icon={<FontAwesomeIcon icon={faTrashUndo} />}
        onClick={() => getDeviceStatus(id)}
      >
        Get Device Status
      </Button>
      {resultGetDeviceStatus.isLoading && (
        <InlineLoading description="Reboot device..." />
      )}
      {resultGetDeviceStatus?.data && (
        <JsonViewer src={resultGetDeviceStatus.data} />
      )}*/}
    </>
  );
}
