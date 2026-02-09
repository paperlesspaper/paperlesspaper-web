import React from "react";
import styles from "./styles.module.scss";
import Empty from "components/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileSearch } from "@fortawesome/pro-regular-svg-icons";
import ButtonRouter from "components/ButtonRouter";
import { Trans } from "react-i18next";
import classNames from "classnames";
import AddIcon from "components/Settings/components/AddIcon";

export default function Repeater({
  addButton,
  addButtonAddition,
  addButtonTo,
  addButtonText,
  children,
  customEmptyContent,
  hideAddButton,
  emptyTitle = "No entry found",
  emptyMessage = "Currently there is no entry found",
}: any) {
  const addButtonElement = addButton ? (
    addButton
  ) : (
    <>
      <ButtonRouter
        data-testid="repeater-add-button"
        to={addButtonTo ? addButtonTo : `/medications/new`}
        icon={<AddIcon />}
      >
        {addButtonText}
      </ButtonRouter>
      {addButtonAddition}
    </>
  );
  return (
    <div className={styles.repeater}>
      <div>
        {children}
        {children.length === 0 && (
          <>
            {customEmptyContent ? (
              customEmptyContent
            ) : (
              <Empty
                kind="large"
                icon={<FontAwesomeIcon icon={faFileSearch} />}
                button={addButtonElement}
                title={<Trans>{emptyTitle}</Trans>}
              >
                <Trans>{emptyMessage}</Trans>
              </Empty>
            )}
          </>
        )}
      </div>
      {children.length !== 0 && !hideAddButton && (
        <div className={styles.addButton}>{addButtonElement}</div>
      )}
    </div>
  );
}

export function RepeaterItem({ className, children, image }: any) {
  const classes = classNames(
    {
      [styles.repeaterItem]: true,
    },
    className
  );

  return (
    <div className={classes}>
      {image && <RepeaterItemImage>{image}</RepeaterItemImage>}
      <div>{children}</div>
    </div>
  );
}

export function RepeaterItemImage({ children }: any) {
  return (
    <div className={styles.repeaterItemImage}>
      {children ? children : "no title"}
    </div>
  );
}

export function RepeaterItemTitle({ children }: any) {
  return (
    <div className={styles.repeaterItemTitle}>
      {children ? children : "no title"}
    </div>
  );
}

export function RepeaterItemContent({ children }: any) {
  return <div className={styles.repeaterItemContent}>{children}</div>;
}
