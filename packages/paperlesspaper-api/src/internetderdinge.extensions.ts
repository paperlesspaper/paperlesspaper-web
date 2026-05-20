import * as internetderdingeApi from "@internetderdinge/api";

const PAPERLESSPAPER_APP_BASE_URL =
  process.env.PAPERLESSPAPER_APP_URL || "https://web.paperlesspaper.de";

const api = internetderdingeApi as any;

api.setCreateOrganizationOwnerUserHook?.(() => ({
  apps: {
    paperlesspaper: {},
  },
}));

api.usersService?.setBuildInviteEmailHook?.(({ lng }: { lng: string }) => ({
  title: "Invite to paperlesspaper",
  domain: "web",
  appBaseUrl: PAPERLESSPAPER_APP_BASE_URL,
  productName: "paperlesspaper",
  companyName: "The Wire UG",
  accountUrl: `${PAPERLESSPAPER_APP_BASE_URL}/account`,
  lng,
}));
