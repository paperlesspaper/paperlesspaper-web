import React from "react";
import {
  List,
  ListItem,
  Module,
  ModuleBody,
  ModuleHeader,
  SecondaryNavigation,
  SecondaryNavigationTitle,
  Wrapper,
} from "@progressiveui/react";
import styles from "./styles.module.scss";
import { updateInfo } from "ducks/update";
import { Trans } from "react-i18next";

export default function Homepage() {
  const appInfo = updateInfo.useGetUpdateInfoQuery(
    {},
    {
      pollingInterval: 1000000,
    },
  );

  return (
    <>
      <SecondaryNavigation>
        <SecondaryNavigationTitle>
          wirewire – <Trans>Admin</Trans>
        </SecondaryNavigationTitle>
      </SecondaryNavigation>

      <Wrapper className={styles.container} background="lighter">
        <Module>
          <ModuleHeader>
            <Trans>App Update</Trans>
          </ModuleHeader>
          <ModuleBody>
            {appInfo.data && (
              <div className={styles.updateInfo}>
                <List kind="simple" colon>
                  <ListItem title={<Trans>Last supported version</Trans>}>
                    {appInfo.data.supportedVersion}
                  </ListItem>
                  <ListItem title={<Trans>Update URL</Trans>}>
                    <a
                      href={appInfo.data.outdatedUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {appInfo.data.outdatedUrl}
                    </a>
                  </ListItem>
                </List>

                {/* <JsonViewer src={appInfo} /> */}
              </div>
            )}
            {!appInfo.data && (
              <p>
                <Trans>Loading app update information...</Trans>
              </p>
            )}
          </ModuleBody>
        </Module>
      </Wrapper>
    </>
  );
}
