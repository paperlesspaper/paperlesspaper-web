import React from "react";
import { Button, Module, ModuleBody, Wrapper } from "@progressiveui/react";
import { Trans } from "react-i18next";
import {
  faStamp,
  faUser,
  faUserGroup,
  faExchangeAlt,
  faQuestionSquare,
  faMessageLines,
} from "@fortawesome/pro-regular-svg-icons";
import { faExternalLinkAlt, faSignOut } from "@fortawesome/pro-solid-svg-icons";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./styles.module.scss";

import { useSidebarData } from "components/Navigation/Navigation";
import InlineLoadingLarge from "components/InlineLoadingLarge";

import useCurrentOrganization from "helpers/organizations/useCurrentOrganization";
import { CurrentUserName } from "components/UserName";
import image from "./management-background.svg";
import imageWirewire from "./managementBackgroundWirewire.jpg";
import useAccount from "helpers/useAccount";
import HelmetTitle from "components/HelmetMeta/HelmetTitle";
import MobileStatusOverlay from "components/MobileTopOverlay";

declare const window: any;

type SettingsAdvancedProps = {
  content: {
    to: string;
    icon: any;
  };
  title: React.ReactNode;
};

export function SettingsAdvancedButton({
  content,
  title,
}: SettingsAdvancedProps) {
  return (
    <Module noMargin>
      <Link to={content?.to} className={styles.buttonLink}>
        <ModuleBody>
          <div className={styles.icon}>
            <FontAwesomeIcon icon={content?.icon} />
          </div>
          <span>{title}</span>
        </ModuleBody>
      </Link>
    </Module>
  );
}

export function SettingsAdvancedLink({
  icon,
  title,
  to,
  external,
  ...other
}: any) {
  const content = (
    <>
      <div className={styles.icon}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <span>{title}</span>
    </>
  );
  if (external) return <a {...other}>{content}</a>;
  return (
    <Link to={to} {...other}>
      {content}
    </Link>
  );
}

export default function SettingsAdvanced() {
  const { organization: currentOrganzation } = useParams();
  const { data: currentOrganization } = useCurrentOrganization();

  const auth0 = useAccount();

  const CHATWOOT_SCRIPT_ID = "chatwoot-sdk";
  const CHATWOOT_BASE_URL = "https://app.chatwoot.com";

  const setChatwootUser = () => {
    if (!auth0.user || !window.$chatwoot) return;
    window.$chatwoot.setUser(auth0.user.email, {
      email: auth0.user.email,
      name: auth0.user.name,
      avatar_url: auth0.user.picture,
    });
  };

  const loadChat = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const openChat = () => {
      setChatwootUser();
      window.$chatwoot?.toggle("open");
    };

    if (window.$chatwoot) {
      openChat();
      return;
    }

    // Ensure the SDK event only opens/chat once it is ready so the widget persists between visits.
    window.addEventListener("chatwoot:ready", openChat, { once: true });

    if (document.getElementById(CHATWOOT_SCRIPT_ID)) {
      return;
    }

    window.chatwootSettings = {
      hideMessageBubble: true,
      position: "right",
      locale: "de",
      showPopoutButton: true,
    };

    const script: HTMLScriptElement = document.createElement("script");
    script.id = CHATWOOT_SCRIPT_ID;
    script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`;
    script.defer = true;
    script.async = true;
    script.onload = function () {
      window.chatwootSDK.run({
        type: "expanded_bubble",
        launcherTitle: "Chat with us",
        websiteToken:
          import.meta.env.REACT_APP_CHATWOOT || "UVs4rG7LZEG5nHgN6oPV75P1",
        baseUrl: CHATWOOT_BASE_URL,
      });
    };

    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head?.appendChild(script);
    }
  };

  const { logout } = auth0;
  if (!currentOrganization)
    return (
      <InlineLoadingLarge description={<Trans>Settings loading...</Trans>} />
    );

  return (
    <div className={styles.wrapper}>
      <MobileStatusOverlay />
      <HelmetTitle>Settings</HelmetTitle>
      <Wrapper pageWidth="md" mobilePageWidth="full">
        <Module noMargin className={styles.main} dark>
          <ModuleBody>
            <img
              src={imageWirewire}
              className={styles.backgroundWirewire}
              alt="Medication icons as supporting background"
            />
            {/*<FontAwesomeIcon
              icon={faClinicMedical}
              className={styles.mainIcon}
  />*/}
            <div className={styles.mainContent}>
              <h3>
                {currentOrganization.isLoading ? (
                  <Trans>Loading...</Trans>
                ) : currentOrganization.data?.name ? (
                  currentOrganization.data?.name
                ) : currentOrganization.data?.kind === "private" ? (
                  <Trans>Settings</Trans>
                ) : (
                  <>
                    <Trans>Hello</Trans> <CurrentUserName />!
                  </>
                )}
              </h3>
              <p>
                {currentOrganization.data?.kind === "professional" && (
                  <Trans>professional organization</Trans>
                )}
              </p>
            </div>
          </ModuleBody>
        </Module>
        <div className={styles.settingsAdvancedButtons}>
          {/*<SettingsAdvancedButton
            content={devices}
            title={
              <>
                {data && data.length} <Trans>Devices</Trans>
              </>
            }
          />*/}
        </div>
        <div className={styles.settingsAdvancedLinks}>
          <SettingsAdvancedLink
            icon={faUser}
            to={`/account?organization=${currentOrganzation}`}
            title={<Trans>Manage account</Trans>}
          />
          <SettingsAdvancedLink
            id="organizationSettingsLink"
            icon={faUserGroup}
            to={`/${currentOrganzation}/organization`}
            title={
              currentOrganization.kind === "professional" ? (
                <Trans>Organization settings</Trans>
              ) : (
                <Trans>Manage group</Trans>
              )
            }
          />
          <SettingsAdvancedLink
            icon={faExchangeAlt}
            to="/?show=always"
            title={<Trans>Switch group</Trans>}
          />

          <SettingsAdvancedLink
            icon={faQuestionSquare}
            external
            href={`${import.meta.env.REACT_APP_SERVER_WEBSITE_URL}/posts`}
            target="_blank"
            title={
              <>
                <Trans>Help & Support</Trans>{" "}
                <FontAwesomeIcon
                  className={styles.externalLink}
                  icon={faExternalLinkAlt}
                />
              </>
            }
          />

          <SettingsAdvancedLink
            icon={faMessageLines}
            external
            onClick={() => loadChat()}
            target="_blank"
            title={<Trans>Chat & report problem</Trans>}
          />

          <SettingsAdvancedLink
            icon={faStamp}
            to={`/${currentOrganzation}/docs/imprint`}
            title={<Trans>Imprint / terms of service</Trans>}
          />

          <Button
            className={styles.logout}
            kind="tertiary"
            icon={<FontAwesomeIcon icon={faSignOut} />}
            onClick={() => logout()}
          >
            <Trans>Logout</Trans>
          </Button>
        </div>
      </Wrapper>
    </div>
  );
}
