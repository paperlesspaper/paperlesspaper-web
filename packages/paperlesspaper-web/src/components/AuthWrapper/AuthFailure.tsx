import React, { useState } from "react";
import { Button } from "@progressiveui/react";
import { Trans } from "react-i18next";
import useAccount from "helpers/useAccount";
import Empty from "components/Empty";
import styles from "./authFailure.module.scss";

export default function AuthFailure() {
  const { authProblem, retryAuthentication } = useAccount();
  const [retrying, setRetrying] = useState(false);
  const connection = authProblem?.kind === "connection";

  return (
    <div role="alert" className={styles.failure}>
      <Empty
        className={styles.message}
        kind="large"
        title={
          <Trans>
            {connection ? "Connection failed" : "Login could not be completed"}
          </Trans>
        }
        button={
          <Button
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await retryAuthentication();
              } finally {
                setRetrying(false);
              }
            }}
          >
            <Trans>Try again</Trans>
          </Button>
        }
      >
        {connection ? (
          <Trans>
            We could not verify your session. Check your internet connection and
            try again. Your saved settings have been kept.
          </Trans>
        ) : (
          <Trans>
            Your session could not be renewed or the login was cancelled. Try
            signing in again. Your saved settings have been kept.
          </Trans>
        )}
      </Empty>
    </div>
  );
}
