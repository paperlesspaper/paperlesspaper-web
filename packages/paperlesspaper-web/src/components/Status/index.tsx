import React from "react";
import { Trans } from "react-i18next";
import { InlineLoading } from "@progressiveui/react";

import ErrorNotice from "./ErrorNotice";
import styles from "./status.module.scss";

function Loading() {
  return <InlineLoading description={<Trans>Loading...</Trans>} />;
}

/**  Status displays the status of a query. It can be used to display a loading */
export default function Status({
  children,
  query,
  validate,
  fetching,
  loading,
  components: overrideComponents = {},
  notSuccessContent,
  forceDebug,
  showError = true,
  showContent = false,
}: any) {
  if (!query) return null;
  const { isFetching, isError, isLoading, isSuccess } = query;

  const success = validate ? validate(query) : isSuccess;

  const defaultComponents = { Loading };

  const components = { ...defaultComponents, ...overrideComponents };

  const info =
    isLoading && loading !== undefined ? (
      loading
    ) : isFetching && fetching !== undefined ? (
      fetching
    ) : isFetching ? (
      <components.Loading />
    ) : isError && showError ? (
      <div>
        <ErrorNotice
          query={query}
          forceDebug={forceDebug}
          className={styles.errorNotice}
        />
      </div>
    ) : null;

  return (
    <>
      {info}
      {isSuccess && !success && notSuccessContent}
      {(showContent || success) && children}
    </>
  );
}
