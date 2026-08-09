import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { BlockNotification, Link, Button } from "@progressiveui/react";
import { useDebug } from "helpers/useCurrentUser";
import JsonViewer from "components/JsonViewer";

export default function ErrorNotice({ className, query, forceDebug }: any) {
  const { t } = useTranslation();
  const isDebug = useDebug();
  const [debugShow, setDebugShow] = useState(false);

  return (
    <BlockNotification
      className={className}
      kind="warning"
      title={
        query.error.status === "FETCH_ERROR"
          ? t("No internet connection")
          : t("Error while loading")
      }
      subtitle={
        <>
          {query.error.status === 403
            ? t(
                "No access allowed. Make sure you have the correct rights to access this page.",
              )
            : query.error.status === "FETCH_ERROR"
              ? t(
                  "The backend server was not found. This is most likely a problem with your internet connection.",
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
