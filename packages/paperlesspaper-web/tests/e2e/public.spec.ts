import { expect, test } from "@playwright/test";
import { captureMilestone } from "./utils/screenshots";

test.describe("Public login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows login actions", async ({ page }, testInfo) => {
    await page.goto("/login");

    await expect(page.getByText("paperlesspaper")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Account" })).toBeVisible();

    await captureMilestone(page, testInfo, "01-login.png");
  });

  test("shows redirect success message", async ({ page }, testInfo) => {
    await page.goto("/redirectsuccess?message=Email%20verified&success=true");

    await expect(page.getByText("Email verified")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await captureMilestone(page, testInfo, "06-redirect-success.png");
  });
});
