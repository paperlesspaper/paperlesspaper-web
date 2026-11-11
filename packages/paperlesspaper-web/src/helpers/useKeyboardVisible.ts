import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

export default function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    const show = () => {
      if (!disposed) setVisible(true);
    };
    const hide = () => {
      if (!disposed) setVisible(false);
    };
    // Completion events also reconcile interrupted/reversed animations.
    const listeners = [
      Keyboard.addListener("keyboardWillShow", show),
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardWillHide", hide),
      Keyboard.addListener("keyboardDidHide", hide),
    ];

    return () => {
      disposed = true;
      // Registration can resolve after an unmount (including StrictMode).
      listeners.forEach((listener) => {
        void listener.then((handle) => handle.remove()).catch(console.error);
      });
    };
  }, []);

  return visible;
}
