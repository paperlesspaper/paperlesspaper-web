import React from "react";
import { useIsDesktop } from "@internetderdinge/web";
import { useTranslation } from "react-i18next";
import styles from "../styles.module.scss";
import { useSettingsContent } from "../SettingsContentContext";
import DeleteModalSettings from "./DeleteModalSettings";

export const DeleteButtonWrapper = (props: any) => {
  const {
    additionalHeader,
    customDelete,

    urlId,

    hideDelete,
    hideHeaderRight,
  } = useSettingsContent();

  const isDesktop = useIsDesktop();

  const { t } = useTranslation();

  if (
    additionalHeader ||
    !customDelete ||
    (urlId !== "new" && !hideDelete && !isDesktop)
  )
    return (
      <>
        <div className={styles.deleteButtonWrapper}>
          {additionalHeader}
          {customDelete ? (
            customDelete
          ) : urlId !== "new" && !hideDelete && !isDesktop ? (
            <div className={styles.deleteButtonWrapperTitle}>
              <DeleteModalSettings {...props} />
            </div>
          ) : null}
        </div>
      </>
    );

  return null;
};
