import React from "react";
import { Button } from "@progressiveui/react";
import { Trans } from "react-i18next";
import styles from "./emptyGoogleCalendar.module.scss";
import GoogleLoginWrapper from "./GoogleLogin";

export default function EmptyGoogleCalendar() {
  return (
    <div className={styles.iframePreview}>
      {/* } <h3>
        <Trans>Please select a website</Trans>
      </h3> */}
      <span>
        {/* <Button onClick={() => setModalOpen("website")}>
          <Trans>Select website</Trans>
        </Button> */}
        <GoogleLoginWrapper />
      </span>
    </div>
  );
}

export function showEmptyGoogleCalendar(store) {
  if (store.entryData?.meta?.googleCalendar?.access_token) {
    return false;
  }
  return true;
}
