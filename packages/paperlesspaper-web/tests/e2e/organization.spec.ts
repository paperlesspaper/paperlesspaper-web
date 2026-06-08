import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  expectGroupSelectionOrOnboarding,
  maybeDeleteOrganization,
  startCreateGroupFlow,
} from "./utils/app";
import { apiJson } from "./utils/api";
import { captureMilestone } from "./utils/screenshots";

type OrganizationsResponse = {
  results: Array<{
    id: string;
    meta?: {
      onboarding?: {
        source?: string;
        status?: string;
      };
    };
  }>;
};

test.describe("Organization onboarding", () => {
  let createdOrganizationId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (!createdOrganizationId) return;

    await maybeDeleteOrganization(page, createdOrganizationId, request);
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

    const initialOrganizationResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/organizations/${createdOrganizationId}`) &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.goto(`/${createdOrganizationId}/organization`);
    await initialOrganizationResponse;
    await expect(page.getByText(/Manage group|Organization settings/)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel("Name of the group").fill(updatedGroupName);
    await page.getByLabel("Description").fill(updatedDescription);
    await expect(page.getByLabel("Name of the group")).toHaveValue(
      updatedGroupName,
    );
    await expect(page.getByLabel("Description")).toHaveValue(updatedDescription);
    await captureMilestone(page, testInfo, "48-organization-settings-edit.png");

    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/organizations/${createdOrganizationId}`) &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByTestId("crud-submit-button").click();
    const updatedOrganization = await (await updateResponse).json();

    expect(updatedOrganization).toMatchObject({
      name: updatedGroupName,
      meta: {
        description: updatedDescription,
      },
    });
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

  test("reuses an incomplete onboarding group when device setup is abandoned", async ({
    page,
    request,
  }) => {
    await startCreateGroupFlow(page);

    await expect(
      page.getByRole("heading", { name: /Create new group|Welcome!/ }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Connect device" }),
    ).toBeVisible({ timeout: 30_000 });

    const createOrganizationResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        url.pathname.endsWith("/organizations") &&
        response.request().method() === "POST" &&
        response.status() === 201
      );
    });

    await page.getByRole("button", { name: "Connect device" }).click();
    const createdOrganization = await (await createOrganizationResponse).json();
    createdOrganizationId = createdOrganization.id;

    await expect(page).toHaveURL(/\/onboarding\/device-create/, {
      timeout: 30_000,
    });

    await page.goto("/?show=always");
    await expectGroupSelectionOrOnboarding(page);
    await expect(page.locator(`a[href$="/${createdOrganizationId}"]`)).toHaveCount(
      0,
    );

    const rootOrganizationCreateRequests: string[] = [];
    const trackRootOrganizationCreate = (networkRequest) => {
      const url = new URL(networkRequest.url());

      if (
        url.pathname.endsWith("/organizations") &&
        networkRequest.method() === "POST"
      ) {
        rootOrganizationCreateRequests.push(networkRequest.url());
      }
    };

    page.on("request", trackRootOrganizationCreate);

    await page.goto("/onboarding?detail=first");
    await expect(
      page.getByRole("heading", { name: /Create new group|Welcome!/ }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Connect device" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Connect device" }).click();
    await expect(page).toHaveURL(/\/onboarding\/device-create/, {
      timeout: 30_000,
    });

    page.off("request", trackRootOrganizationCreate);

    expect(rootOrganizationCreateRequests).toHaveLength(0);

    const organizationsWithPendingGroup = await apiJson<OrganizationsResponse>(
      page,
      request,
      "/organizations",
    );
    const pendingGroup = organizationsWithPendingGroup.results.find(
      (organization) => organization.id === createdOrganizationId,
    );

    expect(pendingGroup?.meta?.onboarding).toMatchObject({
      source: "device-onboarding",
      status: "device-pending",
    });

    const completeOnboardingResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/organizations/${createdOrganizationId}`) &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );

    await page.getByText("Skip for now").click();
    await expect(
      page.getByRole("heading", { name: "Setup complete" }),
    ).toBeVisible({ timeout: 30_000 });
    await completeOnboardingResponse;
    await page.locator("#continueSuccessButton").click();
    await expect(page).toHaveURL(
      new RegExp(`/${createdOrganizationId}/calendar`),
      { timeout: 30_000 },
    );

    const organizationsWithCompletedGroup =
      await apiJson<OrganizationsResponse>(page, request, "/organizations");
    const completedGroup = organizationsWithCompletedGroup.results.find(
      (organization) => organization.id === createdOrganizationId,
    );

    expect(completedGroup?.meta?.onboarding).toMatchObject({
      source: "device-onboarding",
      status: "complete",
    });
  });
});
