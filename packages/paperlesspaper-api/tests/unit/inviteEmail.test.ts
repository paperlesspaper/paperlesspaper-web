import { describe, expect, it, vi } from "vitest";
import { buildInviteEmail } from "../../src/invitations/inviteEmail";

describe("paperlesspaper invitations", () => {
  it.each([
    ["de-DE", "Einladung zur Gruppe", "Einladung annehmen", "de"],
    ["en-GB", "Invitation to the group", "Accept invitation", "en"],
    ["nl-NL", "Uitnodiging voor de groep", "Uitnodiging accepteren", "nl"],
    ["fr", "Invitation to the group", "Accept invitation", "en"],
    [undefined, "Invitation to the group", "Accept invitation", "en"],
  ])("localizes invitation for %s", (lng, title, action, language) => {
    const email = buildInviteEmail({ lng, organization: { name: "Familie" } }, "https://web.paperlesspaper.de");
    expect(email.title).toContain(title);
    expect(email.title).toContain("Familie");
    expect(email.body).toContain("Familie");
    expect(email.actionButtonText).toBe(action);
    expect(email.lng).toBe(language);
    expect(email.senderName).toBe("paperlesspaper");
    expect(email.accountUrl).toBe("https://web.paperlesspaper.de/account");
  });

  it("escapes group names in HTML but keeps the subject readable", () => {
    const email = buildInviteEmail({ lng: "de", organization: { name: '<img src=x> & "Familie"' } }, "https://example.test");
    expect(email.title).not.toContain("<img");
    expect(email.body).toContain("&lt;img src=x&gt; &amp; &quot;Familie&quot;");
    expect(email.subject).toContain('<img src=x> & "Familie"');
  });

  it("registers the hook with the group context and configured app URL", async () => {
    const setBuildInviteEmailHook = vi.fn();
    vi.doMock("@internetderdinge/api", () => ({
      setCreateOrganizationOwnerUserHook: vi.fn(),
      usersService: { setBuildInviteEmailHook },
    }));
    vi.stubEnv("PAPERLESSPAPER_APP_URL", "https://preview.example.test");
    try {
      await import("../../src/internetderdinge.extensions");
      const hook = setBuildInviteEmailHook.mock.calls[0][0];
      expect(hook({ lng: "de", organization: { name: "Büro" } })).toMatchObject({
        senderName: "paperlesspaper", appBaseUrl: "https://preview.example.test",
        subject: "Einladung zur Gruppe „Büro“ bei paperlesspaper",
      });
    } finally {
      vi.unstubAllEnvs();
      vi.doUnmock("@internetderdinge/api");
    }
  });
});
