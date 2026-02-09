import { useAuth0 } from "@auth0/auth0-react";
import { faFingerprint } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Modal } from "@progressiveui/react";
import { accountsApi } from "ducks/accounts";
import { useCurrentAccount } from "helpers/useCurrentUser";
import React from "react";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";

export default function EnableMfaButton() {
  const [getMfaEnrollment, getMfaEnrollmentResult] =
    accountsApi.useGetMfaEnrollmentMutation();

  // New hook for disabling MFA
  const [disableMfa, disableMfaResult] = accountsApi.useDisableMfaMutation();

  const { user, isAuthenticated } = useAuth0();
  const accountWithMeta = useCurrentAccount();

  const [manageMfaOpen, setManageMfaOpen] = React.useState(false);
  const [enrollmentStarted, setEnrollmentStarted] = React.useState(false);

  // Check MFA status in the Auth0 user object (app_metadata or namespaced claim).
  // If you keep the flag on your backend, call an API instead and read that value.
  const isMfaEnabled = accountWithMeta.data?.multifactor?.length > 0;

  const enroll = async () => {
    console.log("Enrolling user in MFA:", accountWithMeta.data);
    if (isMfaEnabled) {
      console.log("User already has MFA enabled");
      return;
    }
    const { data, error } = await getMfaEnrollment({
      userId: user?.sub,
    });
    if (error) {
      console.error("Error fetching MFA enrollment:", error);
      return;
    }

    const ticket_url = data?.data?.ticket_url;

    if (!ticket_url) {
      console.error("No data returned from MFA enrollment");
      return;
    }

    console.log("MFA enrollment ticket URL:", ticket_url);

    //window.location.assign(ticket_url);
  };

  // New function to disable MFA
  const disable = async () => {
    console.log("Disabling MFA for user:", accountWithMeta.data);
    if (!isMfaEnabled) {
      console.log("User does not have MFA enabled");
      return;
    }
    const { data, error } = await disableMfa({
      userId: user?.sub,
    });
    if (error) {
      console.error("Error disabling MFA:", error);
      return;
    }

    console.log("MFA disabled:", data);
    // Refresh the current account to reflect the change (if supported)
    accountWithMeta.refetch?.();
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {getMfaEnrollmentResult.isSuccess && (
        <Modal
          open
          primaryButtonText={<Trans>Close</Trans>}
          modalHeading={<Trans>Two-factor Enrollment</Trans>}
          onRequestClose={() => {
            getMfaEnrollmentResult.reset();
            setEnrollmentStarted(false);
          }}
          onRequestSubmit={() => {
            getMfaEnrollmentResult.reset();
            setEnrollmentStarted(false);
          }}
        >
          {enrollmentStarted ? (
            <>
              <p className={styles.text}>
                <Trans>
                  You have started the enrollment process. Please follow the
                  instructions on the next page to complete the enrollment.
                </Trans>
              </p>
              <p className={styles.text}>
                <Trans>
                  After your are done enrolling, you can close this dialog.
                </Trans>
              </p>
            </>
          ) : (
            <>
              <p className={styles.text}>
                <Trans>
                  Please follow the instructions on the next page to complete
                  the enrollment process.
                </Trans>
              </p>
              <br />
              <Button
                onClick={() => setEnrollmentStarted(true)}
                href={getMfaEnrollmentResult.data?.data?.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                icon={<FontAwesomeIcon icon={faFingerprint} />}
              >
                <Trans>Enable Two-factor Authentication</Trans>
              </Button>
            </>
          )}
        </Modal>
      )}

      {disableMfaResult.isSuccess && (
        <Modal
          open
          primaryButtonText={<Trans>Close</Trans>}
          modalHeading={<Trans>Two-factor Disabled</Trans>}
          onRequestClose={disableMfaResult.reset}
          onRequestSubmit={disableMfaResult.reset}
        >
          <p>
            <Trans>
              Two-factor authentication has been disabled for your account.
            </Trans>
          </p>
        </Modal>
      )}

      {manageMfaOpen && (
        <Modal
          open
          primaryButtonText={<Trans>Close</Trans>}
          modalHeading={<Trans>Manage Two-factor Authentication</Trans>}
          onRequestClose={() => setManageMfaOpen(false)}
          onRequestSubmit={() => setManageMfaOpen(false)}
        >
          <p>
            <Trans>
              You can disable two-factor authentication for your account here.
            </Trans>
          </p>
          <br />
          <Button
            disabled={disableMfaResult.isLoading}
            onClick={disable}
            icon={<FontAwesomeIcon icon={faFingerprint} />}
          >
            <Trans>Disable Two-factor Authentication</Trans>
          </Button>
        </Modal>
      )}

      {isMfaEnabled ? (
        <Button
          icon={<FontAwesomeIcon icon={faFingerprint} />}
          disabled={disableMfaResult.isLoading}
          title="Disable Two-factor Authentication"
          onClick={() => setManageMfaOpen(true)}
        >
          <Trans>Manage Two-factor Authentication</Trans>
        </Button>
      ) : (
        <Button
          onClick={enroll}
          icon={<FontAwesomeIcon icon={faFingerprint} />}
          disabled={isMfaEnabled}
          title={isMfaEnabled ? "Two-factor already enabled" : undefined}
        >
          <Trans>
            {isMfaEnabled ? "Two-factor Enabled" : "Two-factor Authentication"}
          </Trans>
        </Button>
      )}
    </>
  );
}
