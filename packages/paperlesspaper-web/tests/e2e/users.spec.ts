import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

test.describe("User management", () => {
  let createdOrganizationId: string | undefined;

  test.afterEach(async ({ page }) => {
    if (!createdOrganizationId) return;

    await maybeDeleteOrganization(page, createdOrganizationId);
    createdOrganizationId = undefined;
  });

  test("invites a user and shows the pending invite link", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    const invitedUser = {
      id: "507f1f77bcf86cd799439012",
      email: "paperlesspaper-e2e-invite@example.com",
      status: "invited",
      role: "user",
      category: "relative",
      organization: createdOrganizationId,
      inviteCode: "paperlesspaper-e2e-invite-code",
      meta: {},
    };
    let invitePayload: Record<string, unknown> | undefined;

    await page.route("**/users", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      invitePayload = route.request().postDataJSON();

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(invitedUser),
      });
    });

    await page.route(`**/users/${invitedUser.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(invitedUser),
      });
    });

    await page.goto(`/${createdOrganizationId}/users/new`);
    await expect(page.getByText("Invite user").first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel("email").fill(invitedUser.email);
    await captureMilestone(page, testInfo, "38-user-invite-form.png");

    await page
      .getByTestId("crud-submit-button")
      .or(page.getByRole("button", { name: "Create" }))
      .click();

    await expect
      .poll(() => invitePayload)
      .toMatchObject({
        email: invitedUser.email,
        category: "relative",
        role: "user",
        organization: createdOrganizationId,
      });
    await expect(page).toHaveURL(
      new RegExp(`/${createdOrganizationId}/users/${invitedUser.id}`),
      { timeout: 30_000 },
    );
    await expect(page.getByText("Die Einladung wurde versendet.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Waiting to join the group")).toBeVisible();
    await expect(page.getByText(invitedUser.email)).toBeVisible();
    await expect(page.locator("input[readonly]")).toHaveValue(
      new RegExp(`/${createdOrganizationId}/invite/${invitedUser.inviteCode}$`),
    );
    await captureMilestone(page, testInfo, "39-user-invite-pending.png");
  });

  test("updates a user profile and reloads saved values", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    const managedUserId = "507f1f77bcf86cd799439014";
    let managedUser = {
      id: managedUserId,
      role: "user",
      category: "relative",
      organization: createdOrganizationId,
      meta: {
        firstName: "Original",
        lastName: "User",
      },
    };
    let updatePayload: Record<string, unknown> | undefined;

    await page.route(/\/users\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [managedUser] }),
      });
    });

    await page.route(`**/users/${managedUserId}`, async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }

      if (route.request().method() === "POST") {
        updatePayload = route.request().postDataJSON();
        managedUser = {
          ...managedUser,
          ...updatePayload,
          id: managedUserId,
          organization: createdOrganizationId!,
          meta: {
            ...managedUser.meta,
            ...((updatePayload?.meta as typeof managedUser.meta) || {}),
          },
        };
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(managedUser),
      });
    });

    await page.goto(`/${createdOrganizationId}/users/${managedUserId}`);
    await expect(page.getByLabel("First name")).toHaveValue("Original", {
      timeout: 30_000,
    });
    await page.getByLabel("First name").fill("Updated");
    await page.getByLabel("Last name").fill("Relative");
    await captureMilestone(page, testInfo, "44-user-profile-edit.png");

    await page.getByTestId("crud-submit-button").click();

    await expect
      .poll(() => updatePayload)
      .toMatchObject({
        organization: createdOrganizationId,
        role: "user",
        category: "relative",
        meta: {
          firstName: "Updated",
          lastName: "Relative",
        },
      });
    await expect(page.getByText("updated").first()).toBeVisible({
      timeout: 30_000,
    });

    await page.reload();
    await expect(page.getByLabel("First name")).toHaveValue("Updated", {
      timeout: 30_000,
    });
    await expect(page.getByLabel("Last name")).toHaveValue("Relative");
    await captureMilestone(page, testInfo, "45-user-profile-saved.png");
  });

  test("removes a pending invitation", async ({ page }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    const invitedUserId = "507f1f77bcf86cd799439015";
    let deleteRequested = false;
    let users = [
      {
        id: invitedUserId,
        email: "paperlesspaper-e2e-remove-invite@example.com",
        status: "invited",
        role: "user",
        category: "relative",
        organization: createdOrganizationId,
        inviteCode: "paperlesspaper-e2e-remove-invite-code",
        meta: {},
      },
    ];

    await page.route(/\/users\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: users }),
      });
    });

    await page.route(`**/users/${invitedUserId}`, async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }

      if (route.request().method() === "DELETE") {
        deleteRequested = true;
        const [deletedUser] = users;
        users = [];

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(deletedUser),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(users[0]),
      });
    });

    await page.goto(`/${createdOrganizationId}/users/${invitedUserId}`);
    await expect(page.getByText("Waiting to join the group")).toBeVisible({
      timeout: 30_000,
    });
    await captureMilestone(page, testInfo, "46-user-invite-delete-question.png");

    await page.getByTestId("delete-button").click();
    await expect(
      page.getByText("Are you sure that you want to remove the invitation?"),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .locator(".wfp--modal-container")
      .getByRole("button", { name: "Remove" })
      .click();

    await expect.poll(() => deleteRequested).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Delete successful" }),
    ).toBeVisible({ timeout: 30_000 });
    await captureMilestone(page, testInfo, "47-user-invite-deleted.png");
  });
});
