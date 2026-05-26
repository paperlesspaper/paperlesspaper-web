import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { apiJson, apiKeyJson } from "./utils/api";

type TokenRecord = {
  id?: string;
  _id?: string;
  name: string;
  raw?: string;
  value?: string;
  owner?: string;
};

type TokenList = {
  results: TokenRecord[];
};

type UserList = {
  results: Array<{
    id?: string;
    _id?: string;
    organization?: string;
    owner?: string;
  }>;
};

const unrelatedOrganizationId = "507f1f77bcf86cd799439099";

function tokenId(token: TokenRecord): string {
  const id = token.id ?? token._id;

  expect(id, "Created token should include an id").toBeTruthy();
  return id!;
}

test.describe("API token access", () => {
  let createdOrganizationId: string | undefined;
  let createdTokenId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (createdTokenId) {
      await apiJson(page, request, `/tokens/${createdTokenId}`, {
        method: "DELETE",
        expectedStatus: [204, 404],
      });
      createdTokenId = undefined;
    }

    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId, request);
      createdOrganizationId = undefined;
    }
  });

  test("API tokens are owner scoped and blocked from unrelated organizations", async ({
    page,
    request,
  }) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    const createdToken = await apiJson<TokenRecord>(page, request, "/tokens", {
      method: "POST",
      data: { name: `E2E access token ${Date.now()}` },
      expectedStatus: 201,
    });
    createdTokenId = tokenId(createdToken);

    expect(createdToken.raw, "Token raw secret is only returned on create").toMatch(
      /^[a-f0-9]{64}$/,
    );

    const ownUsers = await apiKeyJson<UserList>(
      request,
      `/users?organization=${createdOrganizationId}`,
      createdToken.raw!,
    );
    expect(ownUsers.results.length).toBeGreaterThan(0);
    expect(ownUsers.results.every((user) => Boolean(user.owner))).toBeTruthy();

    const visibleTokens = await apiKeyJson<TokenList>(
      request,
      "/tokens",
      createdToken.raw!,
    );
    expect(
      visibleTokens.results.some((token) => tokenId(token) === createdTokenId),
    ).toBeTruthy();
    expect(JSON.stringify(visibleTokens)).not.toContain(createdToken.raw!);
    expect(
      visibleTokens.results.every((token) => token.owner === createdToken.owner),
    ).toBeTruthy();

    await apiKeyJson(
      request,
      `/users?organization=${unrelatedOrganizationId}`,
      createdToken.raw!,
      { expectedStatus: 403 },
    );

    await apiKeyJson(
      request,
      `/users?organization=${createdOrganizationId}`,
      "0".repeat(64),
      { expectedStatus: 401 },
    );
  });
});
