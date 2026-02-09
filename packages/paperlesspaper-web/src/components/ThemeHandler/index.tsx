import React, { useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "@progressiveui/react";
import { Device } from "@capacitor/device";
import { SafeArea } from "capacitor-plugin-safe-area";

export default function ThemeHandler({
  safeAreaDebug = false,
}: {
  safeAreaDebug?: boolean;
}) {
  const { actualTheme } = useTheme();
  const debugSafeArea = 50;

  function resizeFunction(resizeValue: number) {
    document.body.style.setProperty(
      "--safe-area-inset-top",
      `${resizeValue}px`
    );
  }

  const setStatusBarStyleDark = async () => {
    if (Capacitor.getPlatform() === "android") {
      // await new Promise((r) => setTimeout(r, 2500));

      //await NavigationBar.setTransparency({ isTransparent: false });
      /*
      const info = await Device.getInfo();

      const version = parseFloat(info.osVersion);

      if (version < 14) {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await new Promise((r) => setTimeout(r, 500));
        const sizeWithoutOverlay = document.documentElement.clientHeight;
        await StatusBar.setOverlaysWebView({ overlay: true });
        await new Promise((r) => setTimeout(r, 500));

        const sizeWithOverlay = document.documentElement.clientHeight;
        resizeFunction(sizeWithOverlay - sizeWithoutOverlay);
      }

      */

      SafeArea.getSafeAreaInsets().then(({ insets }) => {
        console.log(insets);

        for (const [key, value] of Object.entries(insets)) {
          document.documentElement.style.setProperty(
            `--safe-area-inset-${key}`,
            `${value}px`
          );
        }
      });

      SafeArea.getStatusBarHeight().then(({ statusBarHeight }) => {
        console.log(statusBarHeight, "statusbarHeight");
      });

      await SafeArea.removeAllListeners();

      // when safe-area changed
      await SafeArea.addListener("safeAreaChanged", (data) => {
        const { insets } = data;
        for (const [key, value] of Object.entries(insets)) {
          console.log(
            "update safe area",
            `--safe-area-inset-${key}`,
            `${value}px`
          );
          document.documentElement.style.setProperty(
            `--safe-area-inset-${key}`,
            `${value}px`
          );
        }
      });

      if (actualTheme === "dark") {
        //  await NavigationBar.setColor({ color: "#000000" });
      } else {
        // await NavigationBar.setColor({ color: "#ffffff" });
      }
      //await NavigationBar.setTransparency({ isTransparent: true });
      /*
      await StatusBar.setOverlaysWebView({ overlay: false });
      const initialHeight = document.documentElement.clientHeight;
      await StatusBar.setOverlaysWebView({ overlay: true });

      const navigationBarColor = await NavigationBar.getColor();

      console.log("navigationBarColor", navigationBarColor);*/

      /* const resizeListener = () => resizeFunction(initialHeight);

      window.addEventListener("resize", resizeListener);
*/

      /*   setTimeout(() => {
        resizeFunction(initialHeight);
      }, 2000);*/
    }
  };

  useEffect(() => {
    if (safeAreaDebug) {
      console.log("set debug safe area");
      document.documentElement.style.setProperty(
        "--safe-area-inset-top",
        `${debugSafeArea}px`
      );
      document.documentElement.style.setProperty(
        "--safe-area-inset-bottom",
        `${debugSafeArea}px`
      );
    } else {
      document.documentElement.style.removeProperty("--safe-area-inset-top");
      document.documentElement.style.removeProperty("--safe-area-inset-bottom");
    }

    if (Capacitor.isNativePlatform()) {
      setStatusBarStyleDark();
      if (actualTheme === "dark") {
        StatusBar.setStyle({ style: Style.Dark });
      } else {
        StatusBar.setStyle({ style: Style.Light });
      }
    }
  }, [actualTheme, safeAreaDebug]);

  return safeAreaDebug ? (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          minHeight: 0,
          height: "var(--safe-area-inset-top)",
          background: "rgba(255, 0, 0, 0.4)",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: 0,
          height: "var(--safe-area-inset-bottom)",
          background: "rgba(255, 0, 0, 0.4)",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </>
  ) : null;
}

/*

import React, { useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "@progressiveui/react";

export default function ThemeHandler() {
  const { actualTheme } = useTheme();

  function resizeFunction(resizeValue: number) {
    console.log(
      "resizeFunction",
      resizeValue,
      document.documentElement.clientHeight
    );
    document.body.style.setProperty(
      "--safe-area-inset-top",
      `${resizeValue}px`
    );
    //window.removeEventListener("resize", resizeListener);
  }

  const setStatusBarStyleDark = async () => {
    /*if (Capacitor.getPlatform() === "ios") {
    } else
    if (Capacitor.getPlatform() === "android") {
      // await new Promise((r) => setTimeout(r, 2500));

      //await StatusBar.setOverlaysWebView({ overlay: false });

      // await new Promise((r) => setTimeout(r, 1000));

      //const sizeWithoutOverlay = document.documentElement.clientHeight;

      // await new Promise((r) => setTimeout(r, 1000));

      await StatusBar.setOverlaysWebView({ overlay: true });

      // const sizeWithOverlay = document.documentElement.clientHeight;

      /*

      console.log("resizeFunction A", document.documentElement.clientHeight);
      await new Promise((r) => setTimeout(r, 500));
      console.log("resizeFunction B", document.documentElement.clientHeight);
      await StatusBar.setOverlaysWebView({ overlay: false });

      await new Promise((r) => setTimeout(r, 500));
      console.log("resizeFunction C", document.documentElement.clientHeight);

      const initialHeight = document.documentElement.clientHeight;
      await new Promise((r) => setTimeout(r, 500));
      console.log("resizeFunction D", document.documentElement.clientHeight);
      await StatusBar.setOverlaysWebView({ overlay: true });*/

/* const resizeListener = () => resizeFunction(initialHeight);

      window.addEventListener("resize", resizeListener);
*/
//console.log("resizeFunction", sizeWithOverlay, sizeWithoutOverlay);
// resizeFunction(sizeWithoutOverlay - sizeWithOverlay);
/*   setTimeout(() => {
        resizeFunction(initialHeight);
      }, 2000);
    }
  };

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setStatusBarStyleDark();
      if (actualTheme === "dark") {
        StatusBar.setStyle({ style: Style.Dark });
      } else {
        StatusBar.setStyle({ style: Style.Light });
      }
    }
  }, [actualTheme]);

  return null;
}*/
