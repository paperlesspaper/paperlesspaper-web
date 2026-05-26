import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  expectGroupSelectionOrOnboarding,
  maybeDeleteOrganization,
} from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

test.describe("Settings navigation", () => {
  let createdOrganizationId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (!createdOrganizationId) return;

    await maybeDeleteOrganization(page, createdOrganizationId, request);
    createdOrganizationId = undefined;
  });

  test("opens advanced settings and linked settings pages", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    await page.goto(`/${createdOrganizationId}/advanced`);
    await expect(page.getByText("Manage account")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Manage group")).toBeVisible();
    await expect(page.getByText("Switch group")).toBeVisible();
    await expect(page.getByText("Imprint / terms of service")).toBeVisible();
    await captureMilestone(page, testInfo, "05-settings.png");

    await page.getByText("Manage group").click();
    await expect(
      page
        .getByRole("heading", { name: "Manage group" })
        .or(page.getByText("Manage group"))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Name of the group")).toBeVisible();

    await page.goto(`/${createdOrganizationId}/advanced`);
    await page.getByText("Switch group").click();
    await expectGroupSelectionOrOnboarding(page);
    await expect(page).toHaveURL(/show=always/);
  });
});
