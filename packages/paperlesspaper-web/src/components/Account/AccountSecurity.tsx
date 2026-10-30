import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Button, Modal, TextInput } from "@progressiveui/react";
import { useTranslation } from "react-i18next";
import { accountsApi } from "ducks/accounts";
import EnableMfaButton from "components/Mfa";
import SecurityPasswordInput from "./SecurityPasswordInput";
import styles from "./accountSecurity.module.scss";

const redirectKey = "paperlesspaper.securityReauthentication";
type Action = "email" | "password";
export const securityError = (error: any) =>
  error?.data?.message || "The change could not be saved. Please try again.";

export default function AccountSecurity({ account }: { account: any }) {
  const { t, i18n } = useTranslation();
  const auth = useAuth0();
  const [pollingInterval, setPollingInterval] = useState(0);
  const status = accountsApi.useGetAccountSecurityQuery(auth.user?.sub, {
    skip: !auth.user?.sub,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
    pollingInterval,
  });
  const [update, mutation] = accountsApi.useUpdateAccountSecurityMutation();
  const [action, setAction] = useState<Action | null>(null);
  const [proof, setProof] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const data = status.currentData || status.data;
  const busy = mutation.isLoading || authenticating;

  useEffect(() => {
    setPollingInterval(data?.pendingEmail ? 15_000 : 0);
  }, [data?.pendingEmail]);

  useEffect(() => {
    if (proof)
      document
        .getElementById(
          action === "email" ? "security-new-email" : "security-new-password"
        )
        ?.focus();
  }, [proof, action]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(redirectKey);
    if (!saved || auth.isLoading) return;
    sessionStorage.removeItem(redirectKey);
    try {
      const intent = JSON.parse(saved);
      if (
        !["email", "password"].includes(intent.action) ||
        Date.now() - intent.startedAt > 10 * 60_000
      )
        return;
      setAction(intent.action);
      auth
        .getIdTokenClaims()
        .then((claims) => {
          if (
            claims?.sub !== intent.subject ||
            !claims.auth_time ||
            Number(claims.auth_time) < Math.floor(intent.startedAt / 1000) - 1
          ) {
            setError("Please sign in again to continue.");
          } else setProof(claims.__raw);
        })
        .catch(() => setError("Please sign in again to continue."));
    } catch {
      setError("Please sign in again to continue.");
    }
  }, [auth.isLoading, auth.getIdTokenClaims]);

  const clearFields = () => {
    setProof("");
    setEmail("");
    setPassword("");
    setRepeat("");
  };
  const close = () => {
    if (busy) return;
    setAction(null);
    setError("");
    clearFields();
    mutation.reset();
  };
  const open = (value: Action) => {
    clearFields();
    setError("");
    setNotice("");
    setAction(value);
  };
  const authenticate = async () => {
    setError("");
    setAuthenticating(true);
    const startedAt = Date.now();
    const subject = auth.user?.sub;
    const authorizationParams = {
      max_age: 0,
      prompt: "login" as const,
      login_hint: data?.email,
      connection: data?.connection,
    };
    try {
      if (Capacitor.isNativePlatform()) {
        sessionStorage.setItem(
          redirectKey,
          JSON.stringify({ action, subject, startedAt })
        );
        await auth.loginWithRedirect({
          authorizationParams,
          appState: { returnTo: "/account" },
          openUrl: async (url) => {
            await Browser.open({ url });
          },
        });
      } else {
        await auth.loginWithPopup({ authorizationParams });
        const claims = await auth.getIdTokenClaims();
        if (
          claims?.sub !== subject ||
          !claims.auth_time ||
          Number(claims.auth_time) < Math.floor(startedAt / 1000) - 1
        )
          throw new Error("Invalid reauthentication");
        setProof(claims.__raw);
      }
    } catch {
      sessionStorage.removeItem(redirectKey);
      setError("Sign-in was not completed. Please try again.");
    } finally {
      setAuthenticating(false);
    }
  };

  const run = async (
    operation: string,
    body?: any,
    method = "post",
    success?: string
  ) => {
    setError("");
    setNotice("");
    try {
      await update({ action: operation, body, method }).unwrap();
      if (success) setNotice(success);
      return true;
    } catch (failure: any) {
      setError(securityError(failure));
      if (failure?.status === 401) clearFields();
      return false;
    } finally {
      // Do not retain the password or ID token in RTK mutation state.
      mutation.reset();
    }
  };
  const submit = async () => {
    if (busy) return;
    if (!proof) return authenticate();
    if (action === "email") {
      if (invalidEmail) return;
      if (
        await run(
          "email",
          {
            email: email.trim(),
            language: i18n.language.startsWith("de") ? "de" : "en",
            reauthToken: proof,
          },
          "post",
          "Confirmation email sent. Your current email remains active until you confirm the new address."
        )
      ) {
        setAction(null);
        clearFields();
      }
    } else if (
      password.length >= 8 &&
      password.length <= 128 &&
      password === repeat
    ) {
      if (
        await run(
          "password",
          { password, reauthToken: proof },
          "post",
          "Your password has been changed."
        )
      ) {
        setAction(null);
        clearFields();
      }
    }
  };
  const resendIn = Math.max(
    0,
    Math.ceil((new Date(data?.resendAvailableAt || 0).getTime() - now) / 1000)
  );
  const providers: string[] = data?.providers || [];
  const social = providers.includes("apple")
    ? "Apple"
    : providers.some((provider) =>
        ["google", "google-oauth2"].includes(provider)
      )
    ? "Google"
    : null;
  const providerUrl =
    social === "Apple"
      ? "https://account.apple.com/"
      : "https://myaccount.google.com/";
  const invalidEmail =
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.trim().toLowerCase() === data?.email?.toLowerCase();

  const cannotSubmit =
    busy ||
    (!!proof &&
      (action === "email"
        ? invalidEmail
        : password.length < 8 || password.length > 128 || password !== repeat));

  return (
    <section
      className={styles.security}
      aria-labelledby="account-security-heading"
    >
      <h3 id="account-security-heading">{t("Sign-in & security")}</h3>
      {notice && (
        <p role="status" className={styles.notice}>
          {t(notice)}
        </p>
      )}
      {error && !action && (
        <p role="alert" className={styles.error}>
          {t(error)}
        </p>
      )}
      {status.isLoading && <p role="status">{t("Loading...")}</p>}
      {status.isError && (
        <div role="alert">
          <p>{t("Account security could not be loaded.")}</p>
          <Button type="button" kind="tertiary" onClick={status.refetch}>
            {t("Try again")}
          </Button>
        </div>
      )}
      {data && (
        <>
          <div className={styles.row}>
            <div>
              <strong>{t("Email")}</strong>
              <p>{data.email}</p>
            </div>
            {data.canChangeEmail && (
              <Button
                type="button"
                kind="tertiary"
                disabled={busy || !!data.pendingEmail}
                onClick={() => open("email")}
              >
                {t("Change email")}
              </Button>
            )}
          </div>
          {data.pendingEmail && (
            <div className={styles.pending}>
              <strong>
                {t("Confirmation pending for {{email}}", {
                  email: data.pendingEmail,
                })}
              </strong>
              <p>
                {t(
                  "Your current email remains active until you confirm the new address. The link expires after 24 hours."
                )}
              </p>
              <div className={styles.actions}>
                <Button
                  type="button"
                  kind="ghost"
                  disabled={busy || resendIn > 0}
                  onClick={() =>
                    run(
                      "email/resend",
                      undefined,
                      "post",
                      "Confirmation email sent."
                    )
                  }
                >
                  {resendIn > 0
                    ? t("Resend in {{seconds}} s", { seconds: resendIn })
                    : t("Resend email")}
                </Button>
                <Button
                  type="button"
                  kind="ghost"
                  disabled={busy}
                  onClick={() =>
                    run("email", undefined, "delete", "Email change cancelled.")
                  }
                >
                  {t("Cancel change")}
                </Button>
              </div>
            </div>
          )}
          {data.hasPassword && (
            <div className={styles.row}>
              <div>
                <strong>{t("Password")}</strong>
                <p>{t("Password is set")}</p>
              </div>
              <Button
                type="button"
                kind="tertiary"
                disabled={busy}
                onClick={() => open("password")}
              >
                {t("Change password")}
              </Button>
            </div>
          )}
          {social && (
            <div className={styles.row}>
              <div>
                <strong>
                  {t("Sign in with {{provider}}", { provider: social })}
                </strong>
                {!data.hasPassword && (
                  <p>
                    {t("You manage your password with {{provider}}.", {
                      provider: social,
                    })}
                  </p>
                )}
              </div>
              <a href={providerUrl} target="_blank" rel="noopener noreferrer">
                {t("Manage {{provider}} account", { provider: social })} ↗
              </a>
            </div>
          )}
          {!data.hasPassword && !social && (
            <p>{t("Manage these login details with your sign-in provider.")}</p>
          )}
        </>
      )}
      <div className={styles.row}>
        <div>
          <strong>{t("Two-factor Authentication")}</strong>
          <p>{t(account?.multifactor?.length ? "Enabled" : "Not enabled")}</p>
        </div>
        <EnableMfaButton compact />
      </div>
      {action && (
        <Modal
          open
          modalAriaLabel={t(
            action === "email" ? "Change email" : "Change password"
          )}
          iconDescription={t("Close")}
          selectorPrimaryFocus="#primaryButton"
          modalHeading={t(
            action === "email" ? "Change email" : "Change password"
          )}
          primaryButtonText={t(
            busy
              ? "Please wait..."
              : !proof
              ? "Confirm your identity"
              : action === "email"
              ? "Send confirmation link"
              : "Change password"
          )}
          secondaryButtonText={t("Cancel")}
          secondaryButtonDisabled={busy}
          onRequestClose={close}
          onSecondarySubmit={close}
          onRequestSubmit={submit}
          primaryButtonDisabled={cannotSubmit}
        >
          <form
            className={styles.dialog}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!cannotSubmit) void submit();
            }}
          >
            {error && (
              <p role="alert" className={styles.error}>
                {t(error)}
              </p>
            )}
            {notice && (
              <p role="status" className={styles.notice}>
                {t(notice)}
              </p>
            )}
            {!proof ? (
              <p>
                {t(
                  "For your security, confirm your identity in the sign-in window. You will then return here to make the change."
                )}
              </p>
            ) : action === "email" ? (
              <>
                <TextInput
                  id="security-new-email"
                  name="newEmail"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  labelText={t("New email address")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  invalid={!!email && invalidEmail}
                  invalidText={t(
                    email.trim().toLowerCase() === data?.email?.toLowerCase()
                      ? "Enter a different email address."
                      : "Enter a valid email address."
                  )}
                />
                <p>
                  {t(
                    "We will send a confirmation link to your new address. Until you confirm it, keep using your current email to sign in."
                  )}
                </p>
              </>
            ) : (
              <>
                <SecurityPasswordInput
                  id="security-new-password"
                  name="newPassword"
                  maxLength={128}
                  autoComplete="new-password"
                  labelText={t("New password")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  helperText={t(
                    "Use at least 8 characters. A long, unique password is best. Additional security requirements are checked when saving."
                  )}
                />
                <SecurityPasswordInput
                  id="security-repeat-password"
                  name="repeatPassword"
                  maxLength={128}
                  autoComplete="new-password"
                  labelText={t("Repeat new password")}
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  disabled={busy}
                  invalid={!!repeat && repeat !== password}
                  invalidText={t("The passwords do not match.")}
                />
              </>
            )}
            {action === "password" && (
              <Button
                type="button"
                kind="ghost"
                disabled={busy}
                onClick={() =>
                  run(
                    "password/reset",
                    undefined,
                    "post",
                    "We sent a password reset link to your current email address."
                  )
                }
              >
                {t("Forgot password?")}
              </Button>
            )}
            <button
              type="submit"
              hidden
              tabIndex={-1}
              disabled={cannotSubmit}
            />
          </form>
        </Modal>
      )}
    </section>
  );
}
