import React from "react";
import { devicesApi } from "ducks/devices";
import styles from "./deviceStatus.module.scss";
import JsonViewer from "components/JsonViewer";
import { Trans } from "react-i18next";

export default function DeviceStatus({ id }: any) {
  const { data: singleDevice } = devicesApi.useGetSingleDevicesQuery(id, {
    skip: id === undefined,
  });

  return (
    <>
      <h3>Status</h3>
      {singleDevice && <JsonViewer src={singleDevice} collapsed={2} />}

      {singleDevice?.deviceStatus?.batLevel && (
        <>
          <br />

          <div className={styles.batteryLevel}>
            <Trans>Batteriestatus</Trans>: {singleDevice.deviceStatus.batLevel}
          </div>
        </>
      )}

      {singleDevice?.iotDevice?.simData?.dataVolumeTotal && (
        <>
          <br />
          <div className={styles.dataVolumeWrapper}>
            <div className={styles.dataVolume}>
              <div
                className={styles.dataVolumeUsed}
                style={{
                  width: `${
                    ((singleDevice.iotDevice.simData.dataVolumeTotal -
                      singleDevice.iotDevice.simData.dataVolumeLeft) /
                      singleDevice.iotDevice.simData.dataVolumeTotal) *
                    100
                  }%`,
                }}
              />
            </div>
            {Math.round(
              singleDevice.iotDevice.simData.dataVolumeTotal -
                singleDevice.iotDevice.simData.dataVolumeLeft
            )}{" "}
            <Trans>MB used</Trans> (
            {Math.round(singleDevice.iotDevice.simData.dataVolumeTotal)}{" "}
            <Trans>MB total</Trans>)
          </div>
        </>
      )}
    </>
  );
}
