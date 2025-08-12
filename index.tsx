import React from "react";
import { Switch, Route } from "react-router-dom";
import styles from "./styles.module.scss";
import EditorWrapper from "./Integrations/ImageEditor/EditorWrapper";

import PhotoList from "./Overview/PhotoList";

export default function EpaperOverview() {
  return (
    <div className={styles.wrapper}>
      <Switch>
        <Route
          path="/:organization/calendar/:kind/:entry/:paper/:paperKind?"
          component={EditorWrapper}
        />
      </Switch>
      <PhotoList />
    </div>
  );
}
