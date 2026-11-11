type InviteEmailContext = {
  lng?: string;
  organization?: { name?: string | null } | null;
};

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);

const copy = {
  de: {
    fallbackGroup: "deiner Gruppe",
    title: (group: string) => `Einladung zur Gruppe „${group}“ bei paperlesspaper`,
    body: (group: string) => `Du wurdest zur Gruppe „${group}“ bei paperlesspaper eingeladen. Klicke auf den Button, um die Einladung anzunehmen.`,
    action: "Einladung annehmen",
  },
  en: {
    fallbackGroup: "your group",
    title: (group: string) => `Invitation to the group “${group}” on paperlesspaper`,
    body: (group: string) => `You have been invited to join the group “${group}” on paperlesspaper. Click the button to accept the invitation.`,
    action: "Accept invitation",
  },
  nl: {
    fallbackGroup: "je groep",
    title: (group: string) => `Uitnodiging voor de groep ‘${group}’ op paperlesspaper`,
    body: (group: string) => `Je bent uitgenodigd voor de groep ‘${group}’ op paperlesspaper. Klik op de knop om de uitnodiging te accepteren.`,
    action: "Uitnodiging accepteren",
  },
};

export function buildInviteEmail(
  { lng, organization }: InviteEmailContext,
  appBaseUrl: string,
) {
  const language = lng?.toLowerCase().split(/[-_]/)[0] || "en";
  const selectedLanguage = Object.hasOwn(copy, language) ? language : "en";
  const text = copy[selectedLanguage as keyof typeof copy];
  const group = organization?.name?.trim() || text.fallbackGroup;
  const title = text.title(group);
  return {
    title: escapeHtml(title),
    subject: title,
    body: escapeHtml(text.body(group)),
    actionButtonText: text.action,
    senderName: "paperlesspaper",
    domain: "web",
    appBaseUrl,
    productName: "paperlesspaper",
    companyName: "The Wire UG",
    accountUrl: `${appBaseUrl}/account`,
    lng: selectedLanguage,
  };
}
