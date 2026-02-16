import React from "react";
import { Empty } from "@progressiveui/react";
import ButtonRouter from "components/ButtonRouter";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";

import image from "../../helpers/devices/eink-display.png";

export default function PatientsEmpty() {
  return (
    <Empty
      icon={<img src={image} className={styles.newIcon} />}
      kind="large"
      title={<Trans>Welcome</Trans>}
      button={
        <ButtonRouter to="/devices/new/?show=always" withOrganization>
          <Trans>New device</Trans>
        </ButtonRouter>
      }
    >
      <Trans>Please setup a device</Trans>
    </Empty>
  );
}
