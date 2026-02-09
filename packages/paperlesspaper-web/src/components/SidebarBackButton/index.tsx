import { faChevronLeft } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useIsDesktop } from "@internetderdinge/web";
import React from "react";
import { Trans } from "react-i18next";
import { NavLink } from "react-router-dom";

import styles from "./styles.module.scss";

const SidebarBackButton = ({ title = "Back" }: { title: string }) => {
  return (
    <span className={styles.backButton}>
      <FontAwesomeIcon icon={faChevronLeft} className={styles.icon} />
      <Trans>{title}</Trans>
    </span>
  );
};

export default SidebarBackButton;

/*
export const SidebarBackButtonWithLink = React.forwardRef(
  (props, showOnDesktop = false, ref) => {
*/
export const SidebarBackButtonWithLink = ({
  showOnDesktop = false,
  to = "/",
  ...props
}: any) => {
  const isDesktop = useIsDesktop();
  const { title = "Back", other } = props;
  if (isDesktop && showOnDesktop === false) return null;
  return (
    <NavLink className={styles.backButton} /*ref={ref}*/ {...other} to={to}>
      <FontAwesomeIcon icon={faChevronLeft} className={styles.icon} />
      <Trans>{title}</Trans>
    </NavLink>
  );
};
