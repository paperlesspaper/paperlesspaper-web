import React, { useState } from "react";
import { Trans } from "react-i18next";
import { BlockNotification, Link, Button } from "@progressiveui/react";
import { useDebug } from "helpers/useCurrentUser";
import JsonViewer from "components/JsonViewer";
import { updateInfo } from "ducks/update";

export default function ErrorNotice({ className, query, forceDebug }: any) {
  const isDebug = useDebug();
  const [debugShow, setDebugShow] = useState(false);

  return (
    <BlockNotification
      className={className}
      kind="warning"
      title={
        <Trans>
          {query.error.status === "FETCH_ERROR"
            ? "No internet connection"
            : "Error while loading"}
        </Trans>
      }
      subtitle={
        <>
          <Trans>
            {query.error.status === 403
              ? "No access allowed. Make sure you have the correct rights to access this page."
              : query.error.status === "FETCH_ERROR"
                ? "The backend server was not found. This is most likely a problem with your internet connection."
                : "Please check your internet connection"}
          </Trans>
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
