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

  test("updates account settings and reloads saved values", async ({
    page,
  }, testInfo) => {
    const initialAccount = {
      user_id: "auth0|paperlesspaper-e2e-account",
      email: "paperlesspaper-e2e-account@example.com",
      email_verified: true,
      given_name: "Paperless",
      family_name: "Tester",
      identities: [{ provider: "auth0" }],
      app_metadata: {
        first_name: "Paperless",
        last_name: "Tester",
        language: "en",
        colorscheme: "light",
        debug: false,
      },
    };
    let account = initialAccount;
    let updatePayload: Record<string, unknown> | undefined;

    await page.route("**/accounts/current", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(account),
      });
    });
    await page.route("**/accounts/**", async (route) => {
      if (route.request().method() === "POST") {
        updatePayload = route.request().postDataJSON();
        account = {
          ...account,
          email: String(updatePayload?.email),
          given_name: String(updatePayload?.given_name),
          family_name: String(updatePayload?.family_name),
          app_metadata: {
            ...account.app_metadata,
            first_name: String(updatePayload?.given_name),
            last_name: String(updatePayload?.family_name),
            language: String(updatePayload?.language),
          },
        };
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(account),
      });
    });

    await page.goto("/account");
    await expect(page.getByText("Account Settings")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel("First name").fill("Updated");
    await page.getByLabel("Last name").fill("Account");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("updated-account@example.com");
    await page.getByLabel(/^Language/).selectOption("de");
    await captureMilestone(page, testInfo, "40-account-settings-edit.png");

    await page.getByTestId("crud-submit-button").click();

    await expect
      .poll(() => updatePayload)
      .toMatchObject({
        given_name: "Updated",
        family_name: "Account",
        email: "updated-account@example.com",
        language: "de",
      });
    await page.reload();
    await expect(page.locator('input[name="given_name"]')).toHaveValue(
      "Updated",
      { timeout: 30_000 },
    );
    await expect(page.locator('input[name="family_name"]')).toHaveValue(
      "Account",
    );
    await expect(page.locator('input[name="email"]')).toHaveValue(
      "updated-account@example.com",
    );
    await expect(page.locator('select[name="language"]')).toHaveValue("de");
    await captureMilestone(page, testInfo, "41-account-settings-saved.png");
  });

  test("creates and deletes an API token", async ({ page }, testInfo) => {
    const account = {
      user_id: "auth0|paperlesspaper-e2e-account",
      email: "paperlesspaper-e2e-account@example.com",
      email_verified: true,
      given_name: "Paperless",
      family_name: "Tester",
      identities: [{ provider: "auth0" }],
      app_metadata: {
        first_name: "Paperless",
        last_name: "Tester",
        language: "en",
        colorscheme: "light",
        debug: false,
      },
    };
    const tokenName = "E2E automation token";
    const createdToken = {
      id: "507f1f77bcf86cd799439016",
      name: tokenName,
      raw: "plp_e2e_generated_token",
      createdAt: "2026-05-25T10:00:00.000Z",
    };
    let tokens: Array<Omit<typeof createdToken, "raw">> = [];
    let createPayload: Record<string, unknown> | undefined;
    let deleteRequested = false;

    await page.route(/\/accounts\/.*$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(account),
      });
    });
    await page.route(/\/tokens\/[^/?]+$/, async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.continue();
        return;
      }

      deleteRequested = true;
      tokens = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createdToken),
      });
    });
    await page.route(/\/tokens(\?|$)/, async (route) => {
      if (route.request().method() === "POST") {
        createPayload = route.request().postDataJSON();
        tokens = [createdToken];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(createdToken),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: tokens }),
      });
    });

    await page.goto("/account");
    await expect(page.getByText("API for Developers")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "Generate Token" }).click();
    const createDialog = page
      .getByRole("dialog")
      .filter({ has: page.getByText("Create new API token") });
    await expect(createDialog).toBeVisible({ timeout: 30_000 });
    await createDialog.getByLabel("Description").fill(tokenName);
    await captureMilestone(page, testInfo, "51-account-token-create.png");
    await createDialog.getByRole("button", { name: "Create" }).click();

    await expect.poll(() => createPayload).toMatchObject({ name: tokenName });
    await expect(page.getByText("Your new token has been generated")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("textbox", { name: "Token" })).toHaveValue(
      createdToken.raw,
    );
    await captureMilestone(page, testInfo, "52-account-token-created.png");
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText(tokenName)).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("button", { name: `Delete token ${tokenName}` })
      .click();
    const deleteDialog = page
      .getByRole("dialog")
      .filter({ has: page.getByText("Are you sure that you want to delete") });
    await expect(deleteDialog).toBeVisible({ timeout: 30_000 });
    await captureMilestone(page, testInfo, "53-account-token-delete.png");
    await deleteDialog.getByRole("button", { name: "Delete" }).click();

    await expect.poll(() => deleteRequested).toBeTruthy();
    await expect(page.getByText(tokenName)).toBeHidden({ timeout: 30_000 });
  });

  test("logs out even when device token cleanup fails", async ({ page }) => {
    let removeDeviceTokenRequested = false;

    await page.route(
      "**/devicesNotifications/removeDeviceToken",
      async (route) => {
        removeDeviceTokenRequested = true;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Device token cleanup failed" }),
        });
      },
    );

    await page.goto("/account");
    await expect(page.getByText("Account Settings")).toBeVisible({
      timeout: 30_000,
    });

    await page
      .context()
      .route(/https:\/\/auth\.wirewire\.de\/v2\/logout.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Logged out</title><h1>Logged out</h1>",
        });
      });

    const logoutRequest = page.waitForRequest(
      (request) => request.url().includes("auth.wirewire.de/v2/logout"),
      { timeout: 30_000 },
    );

    await page.getByRole("button", { name: "Logout" }).first().click();

    const request = await logoutRequest;
    const logoutURL = new URL(request.url());

    expect(removeDeviceTokenRequested).toBeTruthy();
    expect(logoutURL.pathname).toBe("/v2/logout");
  });
});
