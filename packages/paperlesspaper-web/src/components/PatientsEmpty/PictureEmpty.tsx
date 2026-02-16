import React from "react";
import { Empty } from "@progressiveui/react";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";

import image from "../../helpers/devices/eink-display.png";
import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";

export default function PictureEmpty() {
  return (
    <Empty
      icon={<img src={image} className={styles.newIcon} />}
      kind="large"
      title={<Trans>Create first image</Trans>}
      button={
        <NewEntryButton
          icon={<AddIcon />}
          className={styles.fillButton}
          kind="primary"
          small={false}
          iconReverse={false}
        >
          <Trans>New picture</Trans>
        </NewEntryButton>
      }
    >
      <Trans>You can now update the image on the device.</Trans>
    </Empty>
  );
}
