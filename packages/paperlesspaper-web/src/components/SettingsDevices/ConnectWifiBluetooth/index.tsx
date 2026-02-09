import { Button, Callout, Modal } from "@progressiveui/react";
import BluetoothWifiProvisioning from "components/BluetoothWifiProvisioning";
import React from "react";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";

export default function ConnectWifiBluetooth({ currentUserDevicesData }: any) {
  const [status, setStatus] = React.useState("start");
  const [modalOpen, setModalOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>
        <Trans>Connect</Trans>
      </Button>
      <Modal
        open={modalOpen}
        modalHeading={<Trans>Connect new Wifi</Trans>}
        primaryButtonText={
          status === "done" ? <Trans>Close</Trans> : <Trans>Continue</Trans>
        }
        passiveModal={status === "bluetoothConnect"}
        className={styles.modal}
        onRequestSubmit={() => {
          if (status === "start") {
            setStatus("bluetoothConnect");
          }
          if (status === "done") {
            setStatus("start");
            setModalOpen(false);
          }
        }}
        onRequestClose={() => {
          setStatus("start");
          setModalOpen(false);
        }}
      >
        {status === "start" ? (
          <div>
            <p className={styles.description}>
              <Trans>
                When no Wifi is available you can connect to a new Wifi network
                by using Bluetooth.
              </Trans>
            </p>
            <Callout
              title={<Trans>Info</Trans>}
              kind="info"
              className={styles.info}
            >
              <Trans>
                This only works when the device is not connected to an existing
                Wifi network.
              </Trans>
            </Callout>
          </div>
        ) : status === "bluetoothConnect" ? (
          <BluetoothWifiProvisioning
            setAllowSubmit={() => {
              console.log("hel");
            }}
            continueProcess={() => {
              console.log("done");
              setStatus("done");
            }}
            // submitNewDigitalDevice={submitNewDigitalDevice}
            formValues={currentUserDevicesData}
            //startTimer={startTimer}
          />
        ) : (
          <p className={styles.description}>
            <Trans>
              New wifi information sent. Your device will now try to connect to
              the new Wifi network.
            </Trans>
          </p>
        )}
      </Modal>
    </>
  );
}
