import React from "react";
import { Switch, Route } from "react-router-dom";

import EditorWrapper from "../EditorWrapper";

export default function IntegrationEditor() {
  return (
    <Switch>
      <Route
        path="/:organization/:page/:kind/:entry/:paper/:paperKind?"
        component={EditorWrapper}
      />
    </Switch>
  );
}
