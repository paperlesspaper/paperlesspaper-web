import React, { useEffect } from "react";
import { Redirect, useParams, useLocation, useHistory } from "react-router-dom";
import QueryString from "qs";

import Device from "./Device";
import Success from "./Success";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import styles from "./onboarding.module.scss";
import { useIsDesktop } from "@internetderdinge/web";
import Organization from "./Organization";
import DeviceCreate from "./DeviceCreate";
import { getQueryStringValue } from "helpers/useQs";

type OnboardingParams = {
  organization?: string;
  step?: string;
};

function AnimationWrapper({ children }: any) {
  const location = useLocation();
  const history = useHistory();
  const isDesktop = useIsDesktop();

  const prevPath = history.location.state?.prevPath
    ? true
    : history.action === "POP"
      ? true
      : false;

  const pageVariants = isDesktop
    ? {
        initial: () => {
          return {
            y: prevPath ? "-100vh" : "100vh",
          };
        },
        in: () => {
          return {
            y: 0,
          };
        },
        out: () => {
          return {
            y: prevPath ? "100vh" : "-100vh",
          };
        },
      }
    : {
        initial: () => {
          return {
            x: prevPath ? "-100vw" : "100vw",
          };
        },
        in: () => {
          return {
            x: 0,
          };
        },
        out: () => {
          return {
            x: prevPath ? "100vw" : "-100vw",
          };
        },
      };

  const pageTransition: Transition = {
    type: "tween",
    ease: isDesktop ? undefined : "anticipate",
    duration: isDesktop ? 0.2 : 0.5,
  };

  return (
    <motion.div
      className={styles.onboardingWrapper}
      initial="initial"
      animate="in"
      exit="out"
      custom={{ prevPath: location?.state }}
      variants={pageVariants}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

export default function Onboarding() {
  const params = useParams<OnboardingParams>();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params.organization, params.step]);

  const location = useLocation();
  const query = QueryString.parse(location.search, {
    ignoreQueryPrefix: true,
  });
  const legacyOrganization = getQueryStringValue(query.organization);
  const requiresOrganization =
    params.step === "device-create" || params.step === "success";

  if (params.organization && !requiresOrganization) {
    return <Redirect to={`/${params.organization}`} />;
  }

  if (!params.organization && requiresOrganization) {
    if (!legacyOrganization) {
      return <Redirect to="/onboarding" />;
    }

    const canonicalQuery = { ...query };
    delete canonicalQuery.organization;
    const search = QueryString.stringify(canonicalQuery);

    return (
      <Redirect
        to={{
          pathname: `/${legacyOrganization}/onboarding/${params.step}`,
          search: search ? `?${search}` : "",
          hash: location.hash,
        }}
      />
    );
  }

  const content =
    params.step === "device" ? (
      <Device />
    ) : params.step === "device-create" ? (
      <DeviceCreate />
    ) : params.step === "success" ? (
      <Success />
    ) : (
      <Organization />
    );

  return (
    <AnimatePresence initial={false}>
      <AnimationWrapper key={location.pathname}>{content}</AnimationWrapper>
    </AnimatePresence>
  );
}
