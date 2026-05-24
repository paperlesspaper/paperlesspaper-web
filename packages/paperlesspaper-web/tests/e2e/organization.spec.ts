import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

test.describe("Organization onboarding", () => {
  let createdOrganizationId: string | undefined;

  test.afterEach(async ({ page }) => {
    if (!createdOrganizationId) return;

    await maybeDeleteOrganization(page, createdOrganizationId);
    createdOrganizationId = undefined;
  });

  test("creates a group and opens the overview", async ({ page }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    await expect(page.locator("#navigationSettings")).toBeVisible({
      timeout: 30_000,
    });
    await captureMilestone(page, testInfo, "04-organization-created.png");
  });
});
