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
        <SecondaryNavigationTitle>wirewire – Admin</SecondaryNavigationTitle>
      </SecondaryNavigation>

      <Wrapper className={styles.container} background="lighter">
        <Module>
          <ModuleHeader>App Update</ModuleHeader>
          <ModuleBody>
            {appInfo.data && (
              <div className={styles.updateInfo}>
                <List kind="simple" colon>
                  <ListItem title="Last Supported Version">
                    {appInfo.data.supportedVersion}
                  </ListItem>
                  <ListItem title="Update Url">
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
            {!appInfo.data && <p>Loading app update information...</p>}
          </ModuleBody>
        </Module>
      </Wrapper>
    </>
  );
}
