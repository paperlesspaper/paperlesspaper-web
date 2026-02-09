import React from "react";
import styles from "./styles.module.scss";
import PhotoList from "./Overview/PhotoList";
import IntegrationEditor from "./EditorWrapper/IntegrationEditor";
import PullToRefresh from "components/PullToRefresh";

export default function EpaperOverview() {
  return (
    <PullToRefresh className={styles.wrapper}>
      <PhotoList />
      <IntegrationEditor />
    </PullToRefresh>
  );
}
