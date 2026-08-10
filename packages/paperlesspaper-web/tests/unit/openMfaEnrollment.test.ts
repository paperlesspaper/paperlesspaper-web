import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browserOpen: vi.fn(),
  isNativePlatform: vi.fn(),
}));

vi.mock("@capacitor/browser", () => ({
  Browser: { open: mocks.browserOpen },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

import {
  getMfaEnrollmentTicketUrl,
  openMfaEnrollment,
} from "../../src/components/Mfa/openMfaEnrollment";

describe("getMfaEnrollmentTicketUrl", () => {
  it("reads the top-level ticket URL returned by the enrollment API", () => {
    expect(
      getMfaEnrollmentTicketUrl({
        ticket_id: "ticket-id",
        ticket_url: "https://auth.example.com/mfa/ticket",
      })
    ).toBe("https://auth.example.com/mfa/ticket");
  });

  it("rejects missing or invalid ticket URLs", () => {
    expect(getMfaEnrollmentTicketUrl({ data: { ticket_url: "nested" } })).toBe(
      undefined
    );
    expect(getMfaEnrollmentTicketUrl({ ticket_url: "" })).toBe(undefined);
  });
});

describe("openMfaEnrollment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.browserOpen.mockReset();
    mocks.isNativePlatform.mockReset();
  });

  it("opens the enrollment ticket with the native Capacitor browser", async () => {
    mocks.isNativePlatform.mockReturnValue(true);

    await openMfaEnrollment("https://auth.example.com/mfa/ticket");

    expect(mocks.browserOpen).toHaveBeenCalledWith({
      url: "https://auth.example.com/mfa/ticket",
    });
  });

  it("opens the enrollment ticket in a new browser tab on the web", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    await openMfaEnrollment("https://auth.example.com/mfa/ticket");

    expect(windowOpen).toHaveBeenCalledWith(
      "https://auth.example.com/mfa/ticket",
      "_blank",
      "noopener,noreferrer"
    );
    expect(mocks.browserOpen).not.toHaveBeenCalled();
  });

  it("rejects an enrollment response without a ticket URL", async () => {
    await expect(openMfaEnrollment()).rejects.toThrow(
      "Missing MFA enrollment ticket URL"
    );

    expect(mocks.browserOpen).not.toHaveBeenCalled();
  });
});
