import { expect, type Page, test as setup } from "@playwright/test";
import { expectGroupSelectionOrOnboarding } from "./utils/app";

const authFile = ".auth/user.json";

async function logAuth0RedirectDetails(page: Page, label: string) {
  const currentUrl = page.url();

  try {
    const url = new URL(currentUrl);
    const redirectUri = url.searchParams.get("redirect_uri");
    const clientId = url.searchParams.get("client_id");

    console.log(
      `[auth.setup] ${label}: url_origin=${url.origin} pathname=${url.pathname}`,
    );
    console.log(
      `[auth.setup] ${label}: redirect_uri=${redirectUri ?? "(none)"}`,
    );
    console.log(`[auth.setup] ${label}: client_id=${clientId ?? "(none)"}`);
  } catch {
    console.log(`[auth.setup] ${label}: url=${currentUrl}`);
  }
}

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
  await page.waitForLoadState("domcontentloaded");
  await logAuth0RedirectDetails(page, "after login redirect");

  const emailInput = page.getByRole("textbox", { name: /Email address/i });
  const callbackMismatch = page.getByText(
    /Callback URL mismatch|provided redirect_uri/i,
  );

  await Promise.race([
    emailInput.waitFor({ state: "visible", timeout: 30_000 }),
    callbackMismatch
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(async () => {
        await logAuth0RedirectDetails(page, "callback mismatch");
        throw new Error(
          "Auth0 rejected the callback URL. Check the redirect_uri logged above against the allowed callback URLs for the Auth0 client_id logged above.",
        );
      }),
  ]);

  await emailInput.fill(email);

  const passwordInput = page
    .locator('input[name="password"]')
    .or(page.locator('input[type="password"]'))
    .first();
  await expect(passwordInput).toBeVisible({ timeout: 30_000 });
  await passwordInput.fill(password);

  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expectGroupSelectionOrOnboarding(page);
  await page.context().storageState({ path: authFile });
});
