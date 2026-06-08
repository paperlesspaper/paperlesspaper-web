import React from "react";

import styles from "./emptyGoogleCalendar.module.scss";
import GoogleLoginWrapper from "./GoogleLogin";

export default function EmptyGoogleCalendar() {
  return (
    <div
      className={styles.iframePreview}
      // style={{ height: size?.height || "300px", width: size?.width || "100%" }}
    >
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
  const formMeta = store.form?.getValues?.("meta") || {};
  const googleCalendar =
    formMeta.googleCalendar || store.entryData?.meta?.googleCalendar || {};

  return !(
    formMeta.calendarData?.events?.length ||
    formMeta.code ||
    googleCalendar.access_token ||
    googleCalendar.refresh_token ||
    googleCalendar.serverAuthCode
  );
}
