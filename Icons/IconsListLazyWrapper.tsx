import React from "react";
import { lazy } from "react";
import { Trans } from "react-i18next";
// import IconsList from "./IconsList";

const IconsList = lazy(() => import("./IconsList"));

export default function IconsListLazyWrapper(props: any) {
  return (
    <React.Suspense
      fallback={
        <div>
          <Trans>Loading icons...</Trans>
        </div>
      }
    >
      <IconsList {...props} />
    </React.Suspense>
  );
}
