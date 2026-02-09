import { ToastNotification } from "@progressiveui/react";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";
import styles from "./styles.module.scss";
import { updateInfo } from "ducks/update";
import { useVisibility } from "@internetderdinge/web";
import ReactJson from "react-json-view";
import { useDebug } from "helpers/useCurrentUser";

export default function ErrorOverlay({ getToken }: any) {
  const errors = useSelector((state: any) => state.globalState.errors);

  const foreground = useVisibility();
  const isDebug = useDebug();

  useEffect(() => {
    if (errors.length > 0 && errors[errors.length - 1]) {
      console.warn("Api Error: got a rejected action!", errors);

      const error = errors[errors.length - 1];
      if (
        error?.payload?.status === 400 &&
        error.payload.data.message === "User does not exist"
      ) {
        //dispatch(globalState.actions.reset());
        //history.push("/new-user");
      }
      if (
        error?.payload?.status === 401 &&
        error.payload.data.message === "jwt expired"
      ) {
        console.log("Api Error: jwt expired");
        //history.push("/login");
        getToken();
        //dispatch(globalState.actions.reset());
      }
    }
  }, [errors]);

  const currentError =
    errors.length > 0 && errors[errors.length - 1]
      ? errors[errors.length - 1]
      : undefined;

  const appInfo: { data: { supportedVersion: string } } =
    updateInfo.useGetOnlineInfoQuery(
      {},
      {
        pollingInterval: foreground ? 8000 : 100000,
        skip: currentError?.payload?.status !== "FETCH_ERROR",
      }
    );

  /* if (appInfo.isSuccess) {
    return null;
  } */

  return null;

  if (currentError?.payload?.status === "FETCH_ERROR") {
    return (
      <div className={styles.toastWrapper}>
        <div className={styles.toastDebug}>
          {isDebug && <ReactJson src={currentError} />}
        </div>
        <ToastNotification
          lowContrast
          title={<Trans>No internet connection</Trans>}
          subtitle={
            <>
              <Trans>
                The backend server was not found. This is most likely a problem
                with your internet connection.
              </Trans>
            </>
          }
        />
      </div>
    );
  } else return null;
}
