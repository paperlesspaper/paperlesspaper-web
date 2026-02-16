import { useGoogleLogin } from "@react-oauth/google";
import React, { useEffect } from "react";
import useEditor from "../ImageEditor/useEditor";
import { Button, TextInput } from "@progressiveui/react";
import { Trans } from "react-i18next";
import styles from "./googleLogin.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
//import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { SocialLogin } from "@capgo/capacitor-social-login";

import { Capacitor } from "@capacitor/core";

const GOOGLE_SCOPES = [
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function GoogleLoginWrapper() {
  const { form, onSubmit }: any = useEditor();
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
  const serverAuthCode = form.watch("meta.googleCalendar.serverAuthCode");

  const all = form.watch();

  useEffect(() => {
    if (code || serverAuthCode) {
      setStatus("loggedin");
    }
  }, [code, serverAuthCode]);

  async function loginNativeInitialize() {
    await SocialLogin.initialize({
      google: {
        webClientId: import.meta.env.REACT_APP_GOOGLE_CLIENT_ID, // Use Web Client ID for all platforms
        /* androidClientId:
          "719541140462-obfn81aats4fud1c0h8k8f12p71ino10.apps.googleusercontent.com", // for Android */
        iOSClientId:
          "719541140462-gshck1gf8o1s8gqiuu9pnmkjm40prh3g.apps.googleusercontent.com", // for iOS
        iOSServerClientId: import.meta.env.REACT_APP_GOOGLE_CLIENT_ID,
        mode: "offline", // replaces grantOfflineAccess
        // scopes: GOOGLE_SCOPES,
      },
    });

    /* await GoogleAuth.initialize({
      scopes: ["https://www.googleapis.com/auth/calendar"],
    }); */
  }

  useEffect(() => {
    loginNativeInitialize();
  }, []);

  async function loginNative() {
    // const response = await GoogleAuth.signIn();

    console.log("Google Native Login");
    const response = await SocialLogin.login({
      provider: "google",
      options: {
        scopes: GOOGLE_SCOPES,
        forceRefreshToken: true, // if you need refresh token
      },
    });

    console.log("Google Social", response);
    const valued = response.result as any;

    form.setValue("meta.googleCalendar.serverAuthCode", valued.serverAuthCode);

    onSubmit({ ...all, draft: true }, true);

    //{provider: "google", result: {serverAuthCode: "4/0AVGzR1DcaS-xpuqH5WYOK-6nYfTEF0NGH9pCRMhdp5aX6zzhSN5AcdIo4KaVEErYtw", responseType: "offline"}}

    /* form.setValue(
      "meta.googleCalendar.access_token",
      response.result.authentication.accessToken
    );
    form.setValue(
      "meta.googleCalendar.id_token",
      response.result.authentication.idToken
    );
    form.setValue(
      "meta.googleCalendar.refresh_token",
      response.result.authentication.refreshToken
    ); */
  }

  const loginWrapper = async () => {
    console.log("loginWrapper", all);

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
