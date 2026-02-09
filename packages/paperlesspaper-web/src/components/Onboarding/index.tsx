import React, { useEffect } from "react";
import {
  Switch,
  Route,
  useParams,
  useLocation,
  useHistory,
} from "react-router-dom";

import Device from "./Device";
import Patient from "./Patient";
import Success from "./Success";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./onboarding.module.scss";
import { useIsDesktop } from "@internetderdinge/web";
import Organization from "./Organization";
import DeviceCreate from "./DeviceCreate";

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

  const pageTransition = {
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
  const params = useParams();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params]);

  const location = useLocation();

  return (
    <AnimatePresence initial={false}>
      <Switch location={location} key={location.pathname}>
        <Route path="/onboarding/patient">
          <AnimationWrapper>
            <Patient />
          </AnimationWrapper>
        </Route>
        <Route path="/onboarding/device">
          <AnimationWrapper>
            <Device />
          </AnimationWrapper>
        </Route>
        <Route path="/onboarding/device-create">
          <AnimationWrapper>
            <DeviceCreate />
          </AnimationWrapper>
        </Route>
        <Route path="/onboarding/success">
          <AnimationWrapper>
            <Success />
          </AnimationWrapper>
        </Route>
        <Route path="/onboarding">
          <AnimationWrapper>
            <Organization />
          </AnimationWrapper>
        </Route>
      </Switch>
    </AnimatePresence>
  );
}
