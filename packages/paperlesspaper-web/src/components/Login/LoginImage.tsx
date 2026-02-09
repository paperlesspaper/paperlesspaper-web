import React from "react";
import loginBackground from "./login-background.svg";
import loginBackgroundWirewire from "./Introscreen.svg";

import styles from "./loginImage.module.scss";
export default function LoginImage() {
  return (
    <div className={styles.loginContentWirewire}>
      <img alt="Login Background" src={loginBackgroundWirewire} />
    </div>
  );
}
