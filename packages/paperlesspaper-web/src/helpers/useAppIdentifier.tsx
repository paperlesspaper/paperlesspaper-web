import { Capacitor } from "@capacitor/core";

export default function useAppIdentifier() {
  if (Capacitor.getPlatform() === "ios") {
    return import.meta.env.REACT_APP_IDENTIFIER_IOS;
  }
  return import.meta.env.REACT_APP_IDENTIFIER;
}
