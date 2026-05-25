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

  test("updates group settings and requires the exact name before deletion", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);
    const updatedGroupName = `E2E Group ${Date.now()}`;
    const updatedDescription = "Updated by Playwright organization settings";

    await page.goto(`/${createdOrganizationId}/organization`);
    await expect(page.getByText(/Manage group|Organization settings/)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel("Name of the group").fill(updatedGroupName);
    await page.getByLabel("Description").fill(updatedDescription);
    await captureMilestone(page, testInfo, "48-organization-settings-edit.png");
    await page.getByTestId("crud-submit-button").click();

    await expect(page.getByText("updated").first()).toBeVisible({
      timeout: 30_000,
    });

    await page.reload();
    await expect(page.getByLabel("Name of the group")).toHaveValue(
      updatedGroupName,
      { timeout: 30_000 },
    );
    await expect(page.getByLabel("Description")).toHaveValue(
      updatedDescription,
    );

    await page.getByTestId("delete-button").click();
    const modal = page
      .locator(".wfp--modal-container")
      .or(page.locator("[role='dialog']"))
      .filter({
        has: page.getByText("Are you sure you want to delete this organization?"),
      });

    await expect(modal).toBeVisible({ timeout: 30_000 });
    await modal.locator("input").fill("wrong group name");
    await expect(
      modal.getByRole("button", { name: /Delete|Continue/ }).last(),
    ).toBeDisabled();
    await captureMilestone(
      page,
      testInfo,
      "49-organization-delete-validation.png",
    );

    await modal.locator("input").fill(updatedGroupName);
    await modal.getByRole("button", { name: /Delete|Continue/ }).last().click();

    await expect(
      page.getByRole("heading", { name: "Delete successful" }),
    ).toBeVisible({ timeout: 30_000 });
    await captureMilestone(page, testInfo, "50-organization-deleted.png");
    await page
      .locator(".wfp--modal-container")
      .getByRole("button", { name: "Continue" })
      .click();

    await expect(page).toHaveURL(/action=orgDeleted|show=always/, {
      timeout: 30_000,
    });
    createdOrganizationId = undefined;
  });
});
