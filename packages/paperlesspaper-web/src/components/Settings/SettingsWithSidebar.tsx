import React from "react";
import styles from "./settingsSidebar.module.scss";
import {
  Empty,
  SidebarScroll,
  Sidebar,
  InlineLoading,
} from "@progressiveui/react";
import { Search } from "@progressiveui/react";
import { useParams } from "react-router-dom";
import ButtonRouter from "components/ButtonRouter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus } from "@fortawesome/pro-solid-svg-icons";
import { faLayerPlus } from "@fortawesome/pro-light-svg-icons";
import Repeater from "components/Repeater";
import { Trans, useTranslation } from "react-i18next";
import { useMediaQuery } from "react-responsive";
import { mediaQueries } from "@internetderdinge/web";
import i18next from "i18next";
import HelmetTitle from "components/HelmetMeta/HelmetTitle";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import Status from "components/Status";

import { SettingsHeader } from "./SettingsHeader";
import { useIsDesktop } from "@internetderdinge/web";
import ContentNewButton from "./components/ContentNewButton";
import SidebarNewButton from "./components/SidebarNewButton";
import SidebarHeaderButton from "./components/SidebarHeaderButton";
import SidebarSearch from "./components/SidebarSearch";
import { ItemSwipe } from "components/ItemSwipe";

const SettingsWithSidebar = ({
  actions,
  active,
  afterSidebar,
  className,
  components: customComponents,
  search,
  contentNewText,
  customButtons,
  customDetailsOnClick,
  customDetailLink,
  details,
  intro,
  backLink,
  item,
  sortData,
  settingsOverview,
}: any) => {
  const params = useParams();
  const isDesktopOrLaptop = useMediaQuery(mediaQueries.mediaMaxXs);
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  const defaultComponents = {
    ContentNewButton,
    SidebarNewButton,
    SidebarHeaderButton,
    SidebarSearch,
    SettingsHeader,
  };

  const components = { ...defaultComponents, ...customComponents };

  const newLink = `/${settingsOverview.organizationId}/${
    settingsOverview.duckName || settingsOverview.name
  }/new`;

  const filteredDataArray =
    sortData && settingsOverview.filteredDataArray
      ? sortData(settingsOverview.filteredDataArray)
      : settingsOverview.filteredDataArray;

  const Item = item;

  return (
    <>
      <HelmetTitle>{settingsOverview.name}</HelmetTitle>
      <div className={`${styles.sidebarWrapper} ${className || ""}`}>
        <Sidebar
          active={active !== undefined ? active : params.entry}
          sidebar={
            <>
              <components.SettingsHeader
                {...settingsOverview}
                actions={actions}
                backLink={backLink}
                components={components}
                customButtons={customButtons}
                isDesktopOrLaptop={isDesktopOrLaptop}
                contentNewText={contentNewText}
                search={
                  search || (
                    <Search
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          settingsOverview.updateSearch(e, true);
                        }
                      }}
                      onChange={(e) => {
                        settingsOverview.updateSearch(
                          e,
                          e.type === "change" ? false : true
                        );
                      }}
                      value={settingsOverview.searchObject?.search}
                      placeholder={i18next.t("Search...")}
                      className={styles.searchField}
                    />
                  )
                }
              />
              <SidebarScroll>
                {settingsOverview?.getSaved && settingsOverview.getSaved()}
                {intro && intro}

                <Status
                  query={settingsOverview.allQuery}
                  fetching={null}
                  loading={
                    filteredDataArray &&
                    filteredDataArray.length !== 0 ? null : (
                      <Empty>
                        <>
                          <Trans>Loading</Trans>{" "}
                          <Trans>{settingsOverview.name}</Trans>...
                        </>
                      </Empty>
                    )
                  }
                >
                  {filteredDataArray &&
                  filteredDataArray.length === 0 &&
                  settingsOverview.allQuery.isSuccess === true ? (
                    <Empty
                      icon={
                        !isDesktop ? (
                          <FontAwesomeIcon
                            icon={faLayerPlus}
                            size="5x"
                            className={styles.emptyIcon}
                          />
                        ) : undefined
                      }
                      title={
                        <Trans i18nKey="NONAMEFOUND">
                          No {{ NAME: t(`${settingsOverview.name}-SINGULAR`) }}{" "}
                          found
                        </Trans>
                      }
                      button={
                        <components.SidebarNewButton
                          newLink={newLink}
                          contentNewText={contentNewText}
                          name={settingsOverview.name}
                        />
                      }
                    />
                  ) : (
                    <Repeater
                      addButton={
                        <ButtonRouter
                          to={newLink}
                          icon={<FontAwesomeIcon icon={faCirclePlus} />}
                        >
                          <Trans>Add new {settingsOverview.name}</Trans>
                        </ButtonRouter>
                      }
                      hideAddButton
                      className={styles.repeater}
                    >
                      <ItemSwipe
                        items={filteredDataArray}
                        settingsOverview={settingsOverview}
                        customDetailsOnClick={customDetailsOnClick}
                        customDetailLink={customDetailLink}
                        Item={Item}
                      ></ItemSwipe>
                    </Repeater>
                  )}
                </Status>
                {afterSidebar && afterSidebar}
              </SidebarScroll>
            </>
          }
        >
          {!settingsOverview.entry && settingsOverview.allQuery.isLoading ? (
            <Empty>
              <InlineLoading
                description={
                  <>
                    <Trans>Loading</Trans>{" "}
                    <Trans>{settingsOverview.name}</Trans>...
                  </>
                }
              />
            </Empty>
          ) : !settingsOverview.entry &&
            settingsOverview.allQuery.isSuccess &&
            !settingsOverview.allowEmptyDetails ? (
            <>
              <Empty
                icon={
                  <FontAwesomeIcon
                    icon={faLayerPlus}
                    size="5x"
                    className={styles.emptyIcon}
                  />
                }
                title={
                  filteredDataArray && filteredDataArray.length === 0 ? (
                    <Trans i18nKey="NONAMEFOUND">
                      No {{ NAME: t(`${settingsOverview.name}-SINGULAR`) }}{" "}
                      found
                    </Trans>
                  ) : (
                    <Trans i18nKey="SELECTNAME">
                      Select {{ NAME: t(`${settingsOverview.name}-SINGULAR`) }}
                    </Trans>
                  )
                }
                button={
                  <components.ContentNewButton
                    newLink={newLink}
                    contentNewText={contentNewText}
                    name={settingsOverview.name}
                  />
                }
              />
            </>
          ) : (
            details
          )}
        </Sidebar>
      </div>
    </>
  );
};

export default SettingsWithSidebar;

/* Settings form with no sidebar */
export function SettingsSidebarNoSidebar(props: any) {
  const params = useParams();

  return (
    <div id="no-sidebar-scroll" className={styles.noSidebar}>
      <HelmetTitle>{`${props?.name}-SINGULAR`}</HelmetTitle>
      <SettingsContentWrapper
        showReturnDesktop
        overviewUrl={`/${params.organization}/advanced`}
        {...props}
      />
    </div>
  );
}

export function SettingsPageNoSidebar({ children }: any) {
  return (
    <div id="no-sidebar-scroll" className={styles.noSidebar}>
      {children}
    </div>
  );
}

/* Settings form with global image */
export function SettingsGlobal(props) {
  const params = useParams();
  return (
    <div className={styles.settingsGlobal}>
      <SettingsContentWrapper
        //showMobile
        allowScroll
        showReturnDesktop
        overviewUrl={`/${params.organization}/advanced`}
        {...props}
      />
    </div>
  );
}
