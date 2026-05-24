import { expect, test as setup } from "@playwright/test";
import { expectGroupSelectionOrOnboarding } from "./utils/app";

const authFile = ".auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.PLAYWRIGHT_AUTH_EMAIL;
  const password = process.env.PLAYWRIGHT_AUTH_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set PLAYWRIGHT_AUTH_EMAIL and PLAYWRIGHT_AUTH_PASSWORD before running authenticated Playwright tests.",
    );
  }

  await page.goto("/login");
  await page.getByRole("button", { name: "Login" }).click();

  const emailInput = page.getByRole("textbox", { name: /Email address/i });
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(email);

  const passwordInput = page.getByRole("textbox", { name: /^Password/i });
  await expect(passwordInput).toBeVisible({ timeout: 30_000 });
  await passwordInput.fill(password);

  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expectGroupSelectionOrOnboarding(page);
  await page.context().storageState({ path: authFile });
});
