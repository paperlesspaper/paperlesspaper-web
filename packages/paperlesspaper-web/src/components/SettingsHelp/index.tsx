import React from "react";
import { Route, Switch } from "react-router-dom";
import Imprint from "./Imprint";
import Support from "./Support";

export default function SettingsHelp() {
  return (
    <Switch>
      <Route path="/:organization/docs/imprint" component={Imprint} />
      <Route path="/:organization/docs/support" component={Support} />
    </Switch>
  );
}
