import React from "react";
import { Tag } from "@progressiveui/react";
import { NavLink } from "react-router-dom";
import { Trans } from "react-i18next";
import classnames from "classnames";
import styles from "./newIntegrationItem.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";

type IntegrationApp = {
  id: string;
  name: string;
  description: string;
  icon: string;
  status?: string;
};

type Props = {
  app: IntegrationApp;
  // selected: boolean;
  href: string;
  kind?: "highlight";
};

export default function NewIntegrationItem({
  app,
  // selected,
  href,
  kind,
}: Props) {
  return (
    <NavLink
      className={classnames(styles.integrationItem, {
        // [styles.integrationItemSelected]: selected,
        [styles.integrationItemHighlight]: kind === "highlight",
      })}
      to={href}
    >
      <div className={styles.integrationIcon}>
        <div className={styles.iconWrapper}>
          <img src={app.icon} alt={app.name} />
        </div>
      </div>

      <div className={styles.integrationContent}>
        <div className={styles.integrationHeader}>
          <span className={styles.integrationName}>
            {app.name === "Image" ? (
              <Trans>New Image</Trans>
            ) : (
              <Trans>{app.name}</Trans>
            )}
            <FontAwesomeIcon icon={faChevronRight} className={styles.chevron} />
          </span>
          {app.status === "beta" && (
            <Tag className={styles.beta} type="warning">
              Beta
            </Tag>
          )}
        </div>

        <p className={styles.integrationDescription}>
          <Trans>{app.description}</Trans>
        </p>
      </div>
    </NavLink>
  );
}
