import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export function getMfaEnrollmentTicketUrl(response?: unknown) {
  if (!response || typeof response !== "object") return undefined;

  const ticketUrl = (response as { ticket_url?: unknown }).ticket_url;
  return typeof ticketUrl === "string" && ticketUrl.length > 0
    ? ticketUrl
    : undefined;
}

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
