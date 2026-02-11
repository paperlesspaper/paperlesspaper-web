import React from "react";
import SettingsTitle from "components/SettingsTitle";
import { useIsDesktop } from "@internetderdinge/web";
import { Trans, useTranslation } from "react-i18next";
import styles from "../styles.module.scss";
import { InlineLoading } from "@progressiveui/react";
import ReturnButton from "./ReturnButton";
import { useSettingsContent } from "../SettingsContentContext";
import DeleteModalSettings from "./DeleteModalSettings";

export const SettingsContentHeader = (props: any) => {
  const {
    additionalHeader,
    customDelete,
    components,
    name,
    urlId,
    overviewUrl,
    params,
    hideTitle,
    title,
    narrow,
    hideDelete,
    hideHeaderRight,
    showReturnDesktop,
    singleQuery,
    showMobile,
  } = useSettingsContent();

  const isDesktop = useIsDesktop();

  const { t } = useTranslation();

  return (
    <>
      {(showMobile || isDesktop) && (
        <>
          {!narrow && overviewUrl && showReturnDesktop && (
            <ReturnButton overviewUrl={overviewUrl} />
          )}
          <div className={styles.buttonWrapper}>
            {narrow && overviewUrl && showReturnDesktop && (
              <ReturnButton overviewUrl={overviewUrl} narrow />
            )}
            {!hideTitle && (
              <SettingsTitle narrow={narrow}>
                {title ? (
                  title
                ) : (
                  <>
                    {params?.entry === "new" || params?.entry === "first" ? (
                      <Trans i18nKey="newName">New {{ NAME: t(name) }}</Trans>
                    ) : (
                      <Trans i18nKey="detailsName">
                        {{ NAME: t(name) }} details
                      </Trans>
                    )}
                  </>
                )}

                {singleQuery?.isFetching && <InlineLoading />}
              </SettingsTitle>
            )}

            <components.SettingsSubmitButton />

            {!hideHeaderRight && (
              <div className={styles.headerRight}>
                {additionalHeader}
                {customDelete ? (
                  customDelete
                ) : urlId !== "new" && !hideDelete && isDesktop ? (
                  <div className={styles.deleteTitle}>
                    <DeleteModalSettings
                      {...props}
                      customDeleteButtonText="Löschen"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default SettingsContentHeader;
