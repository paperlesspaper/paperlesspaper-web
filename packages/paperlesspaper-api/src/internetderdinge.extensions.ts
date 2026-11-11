import * as internetderdingeApi from "@internetderdinge/api";
import { buildInviteEmail } from "./invitations/inviteEmail";

const PAPERLESSPAPER_APP_BASE_URL =
  process.env.PAPERLESSPAPER_APP_URL || "https://web.paperlesspaper.de";

const api = internetderdingeApi as any;

api.setCreateOrganizationOwnerUserHook?.(() => ({
  apps: {
    paperlesspaper: {},
  },
}));

api.usersService?.setBuildInviteEmailHook?.(
  (context: Parameters<typeof buildInviteEmail>[0]) =>
    buildInviteEmail(context, PAPERLESSPAPER_APP_BASE_URL),
);
