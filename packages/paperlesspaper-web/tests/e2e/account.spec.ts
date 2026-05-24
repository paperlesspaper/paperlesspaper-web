import { expect, test } from "@playwright/test";
import { expectGroupSelectionOrOnboarding } from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

test.describe("Authenticated account navigation", () => {
  test("opens group selection and navigates to account settings", async ({
    page,
  }, testInfo) => {
    await page.goto("/?show=always");
    await expectGroupSelectionOrOnboarding(page);
    await captureMilestone(page, testInfo, "02-groups.png");

    await page.getByRole("button", { name: "Account" }).click();

    await expect(
      page.getByText("Account Settings").or(page.getByText("Dein Account")),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByLabel("Email").or(page.getByText("Manage account")),
    ).toBeVisible();
    await captureMilestone(page, testInfo, "03-account.png");
  });
});
