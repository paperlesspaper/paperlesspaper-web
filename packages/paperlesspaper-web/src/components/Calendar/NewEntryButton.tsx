import React from "react";
import styles from "./newEntryButton.module.scss";
import ButtonRouter from "components/ButtonRouter";
import { useLocation, useParams } from "react-router-dom";
import { Trans } from "react-i18next";
import classnames from "classnames";
import qs from "qs";
import AddIcon from "components/Settings/components/AddIcon";

// <Tooltip newDate={newDate}>
export default function NewEntryButton({
  newDate,
  newTimeCategory,
  content = "regular",
  children,
  kind = "ghost",
  to,
  ...other
}: any) {
  const { kind: kindParam, organization, entry } = useParams();

  const location = useLocation();

  const locationSearch = {
    ...qs.parse(location.search, { ignoreQueryPrefix: true }),
    trayDate: newDate,
    timeCategory: newTimeCategory,
  };

  // TODO: Check validitidy of newDate

  if (!newDate) {
    newDate = "";
  }

  let toFin = null;
  if (to) {
    toFin = to;
  } else {
    toFin = `/${organization}/calendar/user/${entry}/new/${newDate}?${qs.stringify(
      locationSearch
    )}`;
  }

  if (kindParam === "device") {
    toFin = `/${organization}/calendar/device/${entry}/new/${newDate}?${qs.stringify(
      locationSearch
    )}`;
  }

  const classes = classnames(
    {
      [styles.regular]: kind === "regular",
      [styles.newEntryButton]: kind === "ghost",
    },
    "newEntryButton"
  );

  return (
    <ButtonRouter
      small
      kind={kind}
      iconReverse
      to={toFin}
      icon={<AddIcon />}
      className={classes}
      data-testid="new-intake-button"
      {...other}
    >
      {children ? (
        children
      ) : content === "regular" ? (
        <Trans>New Intake</Trans>
      ) : (
        <span className={styles.text}>
          <Trans>new</Trans>
        </span>
      )}
    </ButtonRouter>
  );
}
