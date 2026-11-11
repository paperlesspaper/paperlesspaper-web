import { beforeEach, expect, it, vi } from "vitest";

const getUserByOwner = vi.hoisted(() => vi.fn());
vi.mock("@internetderdinge/api/src/users/users.service", () => ({
  default: { getUserByOwner },
}));
import {
  validateBodyOrganization,
  validateQueryOrganization,
} from "@internetderdinge/api/src/middlewares/validateOrganization";
import { validateOrganizationDelete } from "@internetderdinge/api/src/middlewares/validateAction";

beforeEach(() => vi.resetAllMocks());

// Exercise the real membership and role guards used by claim/preflight, after
// authentication has resolved the account. No real user data or IoT calls.
for (const [location, membershipGuard] of [
  ["body", validateBodyOrganization],
  ["query", validateQueryOrganization],
] as const) {
  const run = async () => {
    const req = {
      auth: { sub: "auth0|second-account" },
      body: { organization: "new-organization" },
      query: { organization: "new-organization" },
    };
    const res = { req };
    const next = vi.fn();
    await membershipGuard(req as any, res as any, next);
    if (next.mock.calls[0]?.[0]) return next.mock.calls[0][0];
    next.mockClear();
    await validateOrganizationDelete(req as any, res as any, next);
    return next.mock.calls[0]?.[0];
  };

  it(`${location}: rejects a non-member before claiming`, async () => {
    getUserByOwner.mockResolvedValue(null);
    await expect(run()).resolves.toMatchObject({ statusCode: 403 });
    expect(getUserByOwner).toHaveBeenCalledExactlyOnceWith("auth0|second-account", "new-organization");
  });

  it(`${location}: uses target-organization membership, independently of the previous device owner`, async () => {
    getUserByOwner.mockResolvedValue({ owner: "auth0|second-account", organization: "new-organization", role: "admin" });
    await expect(run()).resolves.toBeUndefined();
    expect(getUserByOwner).toHaveBeenCalledExactlyOnceWith("auth0|second-account", "new-organization");
  });

  it(`${location}: rejects restricted organization members`, async () => {
    getUserByOwner.mockResolvedValue({ owner: "auth0|second-account", organization: "new-organization", role: "onlyself" });
    await expect(run()).resolves.toMatchObject({ statusCode: 403 });
  });
}
