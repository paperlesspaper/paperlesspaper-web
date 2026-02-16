import React, { useEffect } from "react";
import { Switch, Route, Redirect, useParams } from "react-router-dom";
import ApiPage from "../ApiPage";
import OrganizationPage from "../SettingsOrganization";
import styles from "./styles.module.scss";
import SettingsList from "../Navigation/Navigation";
import SettingsDevices from "components/SettingsDevices";
import SettingsUsers from "components/SettingsUsers";
import CalendarPage from "components/CalendarPage";
import SettingsAdvanced from "components/SettingsAdvanced";
import SettingsHelp from "components/SettingsHelp";
import useCurrentUser from "helpers/useCurrentUser";
import { Empty } from "@progressiveui/react";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle } from "@fortawesome/pro-light-svg-icons";
import PaperLibrary from "components/Epaper/PaperLibrary";

export default function Settings() {
  const params = useParams();
  const { organization } = params;

  const currentUser = useCurrentUser();
  const { error } = currentUser;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params]);

  /* useEffect(() => {
    document.body.className = "fullHeight";
    return () => {
      document.body.className = "";
    };
  }, []);*/

  if (error?.status === 400 || error?.status === 404) {
    return (
      <Empty
        title={<Trans>Organization not found</Trans>}
        icon={<FontAwesomeIcon icon={faQuestionCircle} />}
        button={
          <ButtonRouter to="/">
            <Trans>Home</Trans>
          </ButtonRouter>
        }
      >
        <Trans>
          The selected organization or group was not found. Please go back to
          the home page.
        </Trans>
      </Empty>
    );
  }

  return (
    <>
      <div className={styles.settingsPageWrapper}>
        <div className={styles.settingsPage}>
          <div className={styles.header}></div>
          <div className={styles.wrapper}>
            <SettingsList />

            <div className={styles.content}>
              <Switch>
                <Route
                  path="/:organization/organization"
                  component={OrganizationPage}
                />
                <Route path="/:organization/api" component={ApiPage} />

                <Route
                  path="/:organization/devices/:entry?"
                  component={SettingsDevices}
                />
                <Route path="/:organization/library" component={PaperLibrary} />

                <Route
                  path="/:organization/users/:entry?"
                  component={SettingsUsers}
                />

                <Route
                  path="/:organization/docs/:entry?"
                  component={SettingsHelp}
                />

                <Route
                  path="/:organization/advanced"
                  component={SettingsAdvanced}
                />
                <Route
                  path="/:organization/calendar/:kind?/:entry?/:page?/:action?"
                  component={CalendarPage}
                />

                <Route>
                  <Redirect
                    from="/:organization/"
                    to={`/${organization}/calendar`}
                  />
                </Route>
              </Switch>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
