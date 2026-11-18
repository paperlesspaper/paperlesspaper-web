import React from "react";
import styles from "./styles.module.scss";
import UploadNotice from "./UploadNotice";
import PhotoList from "./Overview/PhotoList";
import IntegrationEditor from "./EditorWrapper/IntegrationEditor";
import PullToRefresh from "components/PullToRefresh";

export default function EpaperOverview() {
  return (
    <PullToRefresh className={styles.wrapper}>
      <UploadNotice />
      <PhotoList />
      <IntegrationEditor />
    </PullToRefresh>
  );
}
