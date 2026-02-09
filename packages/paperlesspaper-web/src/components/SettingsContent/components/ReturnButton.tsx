import { faChevronLeft } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ButtonRouter from "components/ButtonRouter";
import React from "react";
import { Trans } from "react-i18next";
import classnames from "classnames";
import styles from "./returnButton.module.scss";

export default function ReturnButton({ overviewUrl, narrow, normal }: any) {
  const returnButtonClasses = classnames(styles.returnButton, {
    [`${styles.narrow}`]: narrow,
    [`${styles.normal}`]: normal,
  });

  return (
    <div>
      <ButtonRouter
        to={overviewUrl}
        className={returnButtonClasses}
        icon={<FontAwesomeIcon icon={faChevronLeft} />}
        iconReverse
        kind="tertiary"
      >
        <Trans>Return</Trans>
      </ButtonRouter>
    </div>
  );
}
