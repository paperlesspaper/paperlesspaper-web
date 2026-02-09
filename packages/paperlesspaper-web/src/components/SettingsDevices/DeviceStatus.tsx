import React, { useEffect, useState } from "react";
import { BlockNotification, Button } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/pro-solid-svg-icons";
import ButtonRouter from "components/ButtonRouter";
import { Trans } from "react-i18next";
import { useActiveUserDevice } from "helpers/useUsers";
import Battery, { useBatteryStatus } from "components/Battery";
import styles from "./deviceStatus.module.scss";
import { useIsDesktop } from "@internetderdinge/web";
import AddIcon from "components/Settings/components/AddIcon";
import { differenceInDays } from "date-fns";
import { devicesApi } from "ducks/devices";
import { deviceByKind, deviceKindHasFeature } from "helpers/devices/deviceList";
import { useVisibility } from "@internetderdinge/web";
import ConnectWifiBluetooth from "./ConnectWifiBluetooth";

export default function DeviceStatus({ id, className, show = "all" }: any) {
  const {
    data: currentUserDevicesData,
    isLoading: currentUserDevicesIsFetching,
  } = useActiveUserDevice(id);

  const foreground = useVisibility();

  const deviceStatus = devicesApi.useGetSingleDevicesQuery(
    currentUserDevicesData?.id,
    {
      pollingInterval: foreground ? 20000 : 100000,
      skip:
        !currentUserDevicesData?.id ||
        deviceByKind(currentUserDevicesData?.kind)?.analog === true,
    },
  );

  const { status, data: deviceData, isFetching, originalArgs } = deviceStatus;

  const [lastPoolingArgs, setLastPoolingArgs] = useState(false);
  useEffect(() => {
    //if (originalArgs === isPooling) {
    if (status === "fulfilled") setLastPoolingArgs(originalArgs);
    //}
    // setIsPooling(originalArgs);
  }, [status]);

  const isDesktop = useIsDesktop();
  const hasEpaperFeature = deviceKindHasFeature(
    "epaper",
    currentUserDevicesData?.kind,
  );

  const lastSeen = differenceInDays(
    new Date(),
    new Date(deviceData?.deviceStatus?.lastReachableAgo),
  );
  const batteryStatus = useBatteryStatus({
    deviceClass: "memo",
    level: deviceData?.deviceStatus?.batLevel,
    lastSeen,
  });

  if (
    (isFetching && lastPoolingArgs !== originalArgs) ||
    currentUserDevicesIsFetching
  )
    return null;
  // if (currentUserDevicesData?.kind === "epaper") return null;

  if (!currentUserDevicesData)
    return (
      <BlockNotification
        kind="warning"
        title={<Trans>No device assigned</Trans>}
        className={`${styles.blockNotification} ${className}`}
        actions={
          <ButtonRouter withOrganization to={`/devices/new`} icon={<AddIcon />}>
            <Trans>{isDesktop ? "New" : "Add device"}</Trans>
          </ButtonRouter>
        }
        subtitle={<Trans>You need to add a device to the user</Trans>}
      ></BlockNotification>
    );

  if (!hasEpaperFeature) return null;

  if (deviceData?.deviceStatus?.trayIsInserted === "false") {
    return (
      <BlockNotification
        kind="warning"
        title={<Trans>Tray is not inserted</Trans>}
        className={`${styles.blockNotification} ${className}`}
        actions={
          <Button
            href={`${
              import.meta.env.REACT_APP_SERVER_WEBSITE_URL
            }/posts/einsetzen-des-schubfachs`}
            //href="ddsadadas"
            icon={<FontAwesomeIcon icon={faArrowRight} />}
            target="_blank"
          >
            <Trans>Manual</Trans>
          </Button>
        }
        subtitle={<Trans>Please insert the tray to use the device.</Trans>}
      ></BlockNotification>
    );
  }

  if (
    lastSeen <= 2 &&
    deviceKindHasFeature("wifi", currentUserDevicesData?.kind) &&
    show === "all"
  ) {
    return (
      <BlockNotification
        className={`${styles.blockNotification} ${className}`}
        title={<Trans>Reconnect Wifi</Trans>}
        lowContrast
        actions={
          <ConnectWifiBluetooth
            currentUserDevicesData={currentUserDevicesData}
          />
        }
        subtitle={
          <Trans>You can reconnect the device to another wifi network.</Trans>
        }
        hideCloseButton
      />
    );
  }
  if (lastSeen > 2) {
    return (
      <BlockNotification
        className={`${styles.blockNotification} ${className}`}
        kind="warning"
        title={<Trans>Device offline</Trans>}
        icon={
          <Battery
            device={currentUserDevicesData}
            style={{ width: "30px" }}
            className={styles.battery}
          />
        }
        lowContrast
        actions={
          deviceKindHasFeature("wifi", currentUserDevicesData?.kind) ? (
            <ConnectWifiBluetooth
              currentUserDevicesData={currentUserDevicesData}
            />
          ) : null
        }
        subtitle={
          <>
            {deviceKindHasFeature("nbiot", currentUserDevicesData?.kind) ? (
              <Trans lastSeen={lastSeen.toString()} i18nKey="LASTSEENCONTENT">
                Last seen {{ lastSeen }} days ago. Please charge or reset the
                device.
              </Trans>
            ) : (
              <Trans
                lastSeen={lastSeen.toString()}
                i18nKey="LASTSEENCONTENT_WIFI"
              >
                Last seen {{ lastSeen }} days ago. Please change the battery or
                check the wifi connection.
              </Trans>
            )}
          </>
        }
        hideCloseButton
      />
    );
  }

  if (
    isNaN(batteryStatus.levelScaled) &&
    deviceKindHasFeature("battery-level", currentUserDevicesData?.kind)
  ) {
    return (
      <BlockNotification
        className={`${styles.blockNotification} ${className}`}
        kind="warning"
        title={<Trans>No battery level available</Trans>}
        icon={
          <Battery
            device={currentUserDevicesData}
            style={{ width: "30px" }}
            className={styles.battery}
          />
        }
        iconDescription="describes the close button"
        lowContrast
        statusIconDescription="describes the status icon"
        subtitle={
          <Trans>
            Unfortunately the battery status can&apos;t be displayed at the
            moment.
          </Trans>
        }
        hideCloseButton
      />
    );
  }

  if (
    batteryStatus.color === "red" &&
    deviceKindHasFeature("battery-level", currentUserDevicesData?.kind)
  ) {
    return (
      <BlockNotification
        className={`${styles.blockNotification} ${className}`}
        kind="warning"
        title={<Trans>Battery low</Trans>}
        icon={
          <Battery
            device={currentUserDevicesData}
            style={{ width: "30px" }}
            className={styles.battery}
          />
        }
        iconDescription="describes the close button"
        lowContrast
        statusIconDescription="describes the status icon"
        subtitle={<Trans>Please charge the device</Trans>}
        hideCloseButton
      />
    );
  }
  return null;
}
