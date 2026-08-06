import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";

const testDeviceId =
  process.env.PLAYWRIGHT_REAL_DEVICE_ID ?? "epd7-b43a459a1b98";

test.describe("Wi-Fi provisioning", () => {
  let createdOrganizationId: string | undefined;

  test.beforeEach(async ({ page }) => {
    await page.route(/\/devices\/registration-status\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true }),
      });
    });
  });

  test.afterEach(async ({ page, request }) => {
    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId, request);
      createdOrganizationId = undefined;
    }
  });

  test("shows the 2.4 GHz support notice during network selection", async ({
    page,
  }) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    await page.goto(
      `/${createdOrganizationId}/devices/new?e2eMockWifiProvisioning=1`,
    );

    await expect(
      page
        .getByRole("heading", { name: /Register new device|Gerät aktivieren/ })
        .or(page.getByText(/Register new device|Gerät aktivieren/))
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByText("Or type code").click();
    await page.getByPlaceholder("16 to 19-digit code").fill(testDeviceId);
    await page.getByRole("button", { name: "Add device" }).click();

    await expect(page.getByText("Select network")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText("Only 2.4 GHz Wi-Fi networks are supported."),
    ).toBeVisible();
    await expect(page.getByText("paperlesspaper-2.4")).toBeVisible();

    const screenshotPath = path.resolve(
      "output/playwright/wifi-provisioning-24ghz-notice.png",
    );
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test("allows provisioning a network without a password", async ({ page }) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    await page.goto(
      `/${createdOrganizationId}/devices/new?e2eMockWifiProvisioning=1`,
    );
    await page.getByText("Or type code").click();
    await page.getByPlaceholder("16 to 19-digit code").fill(testDeviceId);
    await page.getByRole("button", { name: "Add device" }).click();

    await expect(page.getByText("Select network")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText("paperlesspaper-2.4").click();
    await page.getByRole("button", { name: "Continue" }).click();

    const passwordInput = page.getByLabel("Wi-Fi Password");
    const noPasswordCheckbox = page.getByRole("checkbox", {
      name: "This network has no password",
    });
    const submitButton = page.getByRole("button", { name: "Submit" });

    await expect(passwordInput).toBeEnabled();
    await expect(submitButton).toBeDisabled();
    await passwordInput.fill("temporary-password");
    await expect(submitButton).toBeEnabled();

    await noPasswordCheckbox.check();
    await expect(passwordInput).toBeDisabled();
    await expect(passwordInput).toHaveValue("");
    await expect(submitButton).toBeEnabled();

    await noPasswordCheckbox.uncheck();
    await expect(passwordInput).toBeEnabled();
    await expect(submitButton).toBeDisabled();
  });
});
