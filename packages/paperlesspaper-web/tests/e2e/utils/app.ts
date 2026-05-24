import { expect, type Locator, type Page } from "@playwright/test";

export const groupSelectionOrOnboarding = (page: Page): Locator =>
  page
    .getByRole("heading", { name: "Your groups" })
    .or(page.getByRole("heading", { name: "Welcome!" }))
    .or(page.getByText("Get started"))
    .or(page.getByRole("button", { name: "Create group" }))
    .or(page.getByRole("link", { name: "Current" }))
    .or(page.getByRole("link", { name: "Library" }))
    .or(page.getByRole("button", { name: "Assign user" }));

export async function expectGroupSelectionOrOnboarding(page: Page) {
  await expect(groupSelectionOrOnboarding(page).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function startCreateGroupFlow(page: Page) {
  await page.goto("/?show=always");
  await expectGroupSelectionOrOnboarding(page);

  const addGroupButton = page
    .getByTestId("repeater-add-button")
    .or(page.getByRole("button", { name: "Create group" }));

  await addGroupButton.first().click();
}

export async function createTemporaryOrganization(page: Page): Promise<string> {
  await startCreateGroupFlow(page);

  await expect(
    page.getByRole("heading", { name: /Create new group|Welcome!/ }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Connect device" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Skip step" }).click();

  await expect(
    page.getByRole("heading", { name: "Setup complete" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.locator("#continueSuccessButton").click();

  await expect(page).toHaveURL(/\/[^/]+\/calendar/, { timeout: 30_000 });

  return new URL(page.url()).pathname.split("/")[1];
}

export async function maybeDeleteOrganization(
  page: Page,
  organizationId: string,
) {
  await page.goto(`/${organizationId}/organization`);
  await expect(page.getByText(/Manage group|Organization settings/)).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("delete-button").click();

  const validationInput = page
    .locator(".wfp--modal-container input")
    .or(page.locator("[role='dialog'] input"));

  if (await validationInput.first().isVisible()) {
    const nameInput = page
      .getByLabel("Name of the group")
      .or(page.getByLabel("Name of the organization"));
    const organizationName = await nameInput.first().inputValue();

    await validationInput.first().fill(organizationName);
  }

  await page
    .locator(".wfp--modal-container")
    .or(page.locator("[role='dialog']"))
    .getByRole("button", { name: /Delete|Continue/ })
    .last()
    .click();

  await expect(
    page.getByRole("heading", { name: "Delete successful" }),
  ).toBeVisible({ timeout: 30_000 });
  await page
    .locator(".wfp--modal-container")
    .getByRole("button", { name: "Continue" })
    .click();

  await expect(page).toHaveURL(/action=orgDeleted|show=always/, {
    timeout: 30_000,
  });
}
