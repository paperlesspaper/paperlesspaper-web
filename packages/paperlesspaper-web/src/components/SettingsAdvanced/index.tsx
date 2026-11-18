import React, { useEffect, useState } from "react";
import { Button, Module, ModuleBody, Wrapper } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
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
import InlineLoadingLarge from "components/InlineLoadingLarge";

import useCurrentOrganization from "helpers/organizations/useCurrentOrganization";
import { CurrentUserName } from "components/UserName";
import backgroundImage from "./backgroundc.jpg";
import useAccount from "helpers/useAccount";
import HelmetTitle from "components/HelmetMeta/HelmetTitle";
import MobileStatusOverlay from "components/MobileTopOverlay";
import { Capacitor } from "@capacitor/core";
import { supportApi } from "ducks/supportApi";
import { onSupportChatError, openSupportChat } from "helpers/supportChat";

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
  if (external && other.onClick && !other.href)
    return (
      <button type="button" {...other}>
        {content}
      </button>
    );
  if (external) return <a {...other}>{content}</a>;
  return (
    <Link to={to} {...other}>
      {content}
    </Link>
  );
}

export default function SettingsAdvanced() {
  const { t } = useTranslation();
  const { organization: currentOrganzation } = useParams();
  const { data: currentOrganization } = useCurrentOrganization();

  const auth0 = useAccount();
  const [getChatwootIdentity] = supportApi.useLazyGetChatwootIdentityQuery();

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(false);

  useEffect(() => onSupportChatError(() => setChatError(true)), []);

  const loadChat = async () => {
    setChatError(false);
    setChatLoading(true);
    try {
      if (!auth0.user)
        throw new Error("Support chat requires a signed-in user");
      await openSupportChat({
        getIdentity: () => getChatwootIdentity().unwrap(),
        user: auth0.user,
        platform: Capacitor.getPlatform(),
        native: Capacitor.isNativePlatform(),
        launcherTitle: t("Chat with us"),
      });
    } catch {
      setChatError(true);
    } finally {
      setChatLoading(false);
    }
  };

  const { logout } = auth0;
  if (!currentOrganization)
    return (
      <InlineLoadingLarge description={<Trans>Settings loading...</Trans>} />
    );

  return (
    <div className={styles.wrapper} data-navigation-scroll-container>
      <MobileStatusOverlay />
      <HelmetTitle>Settings</HelmetTitle>
      <Wrapper pageWidth="md" mobilePageWidth="full">
        <Module noMargin className={styles.main} dark>
          <ModuleBody>
            <img src={backgroundImage} className={styles.background} alt="" />
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
            className={styles.supportChat}
            onClick={loadChat}
            disabled={chatLoading}
            aria-busy={chatLoading}
            title={
              chatLoading ? (
                <Trans>Loading support chat…</Trans>
              ) : (
                <Trans>Chat & report problem</Trans>
              )
            }
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
        {chatError && (
          <div role="alert" className={styles.chatError}>
            <p>
              <Trans>
                Your previous chats could not be loaded. Please try again.
              </Trans>
            </p>
            <Button onClick={loadChat} disabled={chatLoading}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        )}
      </Wrapper>
    </div>
  );
}
