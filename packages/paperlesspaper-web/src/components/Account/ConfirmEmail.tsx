import React, { useState } from "react";
import { Button } from "@progressiveui/react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { accountsApi } from "ducks/accounts";
import { securityError } from "./AccountSecurity";
import {
  readEmailConfirmationToken,
  clearEmailConfirmationToken,
} from "./emailConfirmationToken";
import styles from "./accountSecurity.module.scss";

// Public landing page: a user can verify their new mailbox on another device.
// Keep the secret in the URL fragment, remove it from history, and require an
// explicit POST so link previews and mail scanners cannot change the account.
export default function ConfirmEmail() {
  const { t } = useTranslation();
  const [token, setToken] = useState(readEmailConfirmationToken);
  const [confirm, result] = accountsApi.useConfirmAccountEmailMutation();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (result.isLoading) return;
    setError("");
    try {
      await confirm(token).unwrap();
      setSuccess(true);
      setToken("");
      clearEmailConfirmationToken();
    } catch (failure) {
      setError(securityError(failure));
    } finally {
      result.reset();
    }
  };
  return (
    <main className={styles.confirmation}>
      <h1>
        {t(
          success ? "Email address confirmed" : "Confirm your new email address"
        )}
      </h1>
      {success ? (
        <>
          <p role="status">
            {t(
              "Your email address has been changed. Use your new address the next time you sign in."
            )}
          </p>
          <Link to="/account">{t("Go to account")}</Link>
        </>
      ) : (
        <>
          <p>
            {t(
              "Confirm this change to start using your new email address for paperlesspaper."
            )}
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {t(error)}
            </p>
          )}
          {!/^[a-f0-9]{64}$/.test(token) ? (
            <p role="alert">
              {t("This confirmation link is invalid or has expired.")}
            </p>
          ) : (
            <Button type="button" disabled={result.isLoading} onClick={submit}>
              {t(result.isLoading ? "Please wait..." : "Confirm email address")}
            </Button>
          )}
          <p>
            <Link to="/account">{t("Go to account")}</Link>
          </p>
        </>
      )}
    </main>
  );
}
