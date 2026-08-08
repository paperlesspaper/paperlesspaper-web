import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export async function openMfaEnrollment(ticketUrl?: string) {
  if (!ticketUrl) {
    throw new Error("Missing MFA enrollment ticket URL");
  }

  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: ticketUrl });
    return;
  }

  window.open(ticketUrl, "_blank", "noopener,noreferrer");
}
