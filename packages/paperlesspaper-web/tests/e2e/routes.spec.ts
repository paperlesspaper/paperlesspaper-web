import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

test.describe("Authenticated route coverage", () => {
  let createdOrganizationId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (!createdOrganizationId) return;

    await maybeDeleteOrganization(page, createdOrganizationId, request);
    createdOrganizationId = undefined;
  });

  test("opens primary organization routes and tools", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    await page.goto(`/${createdOrganizationId}/library`);
    await expect(page).toHaveURL(new RegExp(`/${createdOrganizationId}/library`));
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page
        .getByRole("button", { name: "New picture" })
        .or(page.getByRole("heading", { name: "No pictures yet" }))
        .first(),
    ).toBeVisible();
    await captureMilestone(page, testInfo, "07-library.png");

    await page.goto(`/${createdOrganizationId}/users`);
    await expect(page).toHaveURL(new RegExp(`/${createdOrganizationId}/users`));
    await expect(
      page
        .getByRole("link", { name: "Users" })
        .or(page.getByRole("button", { name: "Invite" }))
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto(`/${createdOrganizationId}/devices`);
    await expect(page).toHaveURL(new RegExp(`/${createdOrganizationId}/devices`));
    await expect(
      page
        .getByRole("link", { name: "Devices" })
        .or(page.getByText(/No Device found|Add new devices/))
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto(`/${createdOrganizationId}/api`);
    await expect(page.getByText("Connected Apps")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByLabel("Api url")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

    await page.goto(`/${createdOrganizationId}/calendar`);
    await expect(page.getByRole("link", { name: "Current" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("#navigationSettings")).toBeVisible();
    await captureMilestone(page, testInfo, "08-calendar.png");
  });
});
