import React from "react";
import { Trans } from "react-i18next";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import PlaylistSchedule from "./PlaylistSchedule";
import RotateScreen from "../../Fields/RotateScreen";
import DeletePaper from "../ImageEditor/DeletePaper";
import styles from "./playlistSchedule.module.scss";

const Elements = () => {
  return (
    <>
      <RotateScreen />
      <DeletePaper />
    </>
  );
};

export default function PlaylistEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "playlist" } });

  return (
    <IntegrationModal
      elements={Elements}
      store={store}
      modalHeading={<Trans>Display Playlist</Trans>}
      passiveModal
      modalKind="fullscreen"
      modalClassName={styles.playlistModal}
    >
      <PlaylistSchedule />
    </IntegrationModal>
  );
}
