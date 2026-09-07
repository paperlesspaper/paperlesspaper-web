import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { BlockNotification, Link, Button } from "@progressiveui/react";
import { useDebug } from "helpers/useCurrentUser";
import JsonViewer from "components/JsonViewer";

export default function ErrorNotice({ className, query, forceDebug }: any) {
  const { t } = useTranslation();
  const isDebug = useDebug();
  const [debugShow, setDebugShow] = useState(false);
  const isFetchError = query.error.status === "FETCH_ERROR";
  const isOffline =
    isFetchError &&
    typeof navigator !== "undefined" &&
    navigator.onLine === false;

  return (
    <BlockNotification
      className={className}
      kind="warning"
      title={
        isFetchError
          ? isOffline
            ? t("No internet connection")
            : t("Backend is down")
          : t("Error while loading")
      }
      subtitle={
        <>
          {query.error.status === 403
            ? t(
                "No access allowed. Make sure you have the correct rights to access this page.",
              )
            : isFetchError
              ? isOffline
                ? t("Please check your internet connection")
                : t(
                    "The backend server could not be reached. Please try again later.",
                  )
              : t("Please check your internet connection")}
          {(isDebug || forceDebug) && (
            <>
              <br />
              <br />
              {!debugShow && (
                <Link onClick={() => setDebugShow(!debugShow)}>
                  <Trans>Show error message</Trans>
                </Link>
              )}
              {debugShow && <JsonViewer src={query} />}
            </>
          )}
        </>
      }
      actions={
        <Button onClick={query.refetch}>
          <Trans>Refetch</Trans>
        </Button>
      }
    />
  );
}
