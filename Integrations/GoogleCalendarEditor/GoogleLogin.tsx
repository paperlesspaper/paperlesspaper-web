import { useGoogleLogin } from "@react-oauth/google";
import React, { useEffect } from "react";
import useEditor from "../ImageEditor/useEditor";
import { Button, TextInput } from "@progressiveui/react";
import { Trans } from "react-i18next";
import styles from "./googleLogin.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { Capacitor } from "@capacitor/core";

function GoogleLoginWrapper() {
  const { form, handleSubmit, onSubmit }: any = useEditor();
  const [status, setStatus] = React.useState("loggedout");

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/calendar",
    // prompt: "consent",
    // access_type: "offline",

    // redirect_uri: "http://localhost:3200",
    // ux_mode: "redirect",
    // ux_mode: "redirect",
    onSuccess: async (codeResponse) => {
      form.setValue("meta.code", codeResponse.code);

      onSubmit({ ...all, draft: true }, true);
    },
    onError: () => {
      alert("Login Failed");
      console.error("Login Failed");
    },
  });

  const code = form.watch("meta.code");
  const accessToken = form.watch("meta.googleCalendar.access_token");

  const all = form.watch();

  console.log("code", all);

  useEffect(() => {
    if (code || accessToken) {
      setStatus("loggedin");
    }
  }, [code, accessToken]);

  async function loginNativeInitialize() {
    await GoogleAuth.initialize({
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }

  useEffect(() => {
    loginNativeInitialize();
  }, []);

  async function loginNative() {
    const response = await GoogleAuth.signIn();
    console.log(response);

    form.setValue(
      "meta.googleCalendar.access_token",
      response.authentication.accessToken
    );
    form.setValue(
      "meta.googleCalendar.id_token",
      response.authentication.idToken
    );
    form.setValue(
      "meta.googleCalendar.refresh_token",
      response.authentication.refreshToken
    );
  }

  const loginWrapper = async () => {
    console.log("loginWrapper", all);

    /*   formRef.current.dispatchEvent(
      new Event("submit", { cancelable: true, bubbles: true })
    ); */
    if (Capacitor.isNativePlatform()) {
      await loginNative();
    } else {
      login();
    }
  };

  return (
    <div className={styles.wrapper}>
      {status === "loggedin" ? (
        <div className={styles.loggedin}>
          <div className={styles.message}>
            <Trans>You are already signed in</Trans>
          </div>
          <Button
            onClick={() => login()}
            kind="tertiary"
            className={styles.loggedinButton}
          >
            <Trans>Change account</Trans>
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => loginWrapper()}
          className={styles.loginButton}
          icon={<FontAwesomeIcon icon={faGoogle} />}
          iconReverse
        >
          <Trans>Sign in with Google</Trans>
        </Button>
      )}

      <TextInput {...form.register("meta.code")} hidden />

      <TextInput
        {...form.register("meta.googleCalendar.access_token")}
        hidden
      />
    </div>
  );
}

export default GoogleLoginWrapper;
