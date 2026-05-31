import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

type DeviceResponse = {
  id: string;
  deviceId: string;
  kind: string;
  organization: string;
  patient?: string | null;
  meta?: {
    name?: string;
    sleepTime?: string;
    showOverlay?: boolean;
    updateSchedule?: {
      enabled?: boolean;
      timezone?: string;
      windows?: Array<{
        id: string;
        startsAt: string;
        durationMinutes: number;
        repeat: string;
        rrule?: string;
      }>;
    };
  };
};

const testDeviceId = "epd7-settings-e2e";
const testDeviceObjectId = "507f1f77bcf86cd799439013";

test.describe("Device settings", () => {
  let createdOrganizationId: string | undefined;
  test.afterEach(async ({ page, request }) => {
    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId, request);
      createdOrganizationId = undefined;
    }
  });

  test("updates epaper device settings and reloads saved values", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    let currentDevice: DeviceResponse = {
      id: testDeviceObjectId,
      deviceId: testDeviceId,
      kind: "epd7",
      organization: createdOrganizationId,
      patient: null,
      meta: {
        name: "Original settings device",
        sleepTime: "3600",
        showOverlay: true,
      },
    };
    let updatePayload: Record<string, unknown> | undefined;

    await page.route(/\/devices\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [currentDevice] }),
      });
    });

    await page.route(`**/devices/${testDeviceObjectId}`, async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }

      if (route.request().method() === "POST") {
        updatePayload = route.request().postDataJSON();
        currentDevice = {
          ...currentDevice,
          ...updatePayload,
          id: testDeviceObjectId,
          kind: "epd7",
          organization: createdOrganizationId!,
          meta: {
            ...currentDevice.meta,
            ...((updatePayload?.meta as DeviceResponse["meta"]) || {}),
          },
        };
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentDevice),
      });
    });

    await page.goto(`/${createdOrganizationId}/devices/${testDeviceObjectId}`);
    await expect(
      page
        .getByRole("heading", { name: "Edit device" })
        .or(page.getByText("Edit device"))
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    const nameInput = page.getByRole("textbox", { name: "Name" });
    await expect(nameInput).toHaveValue("Original settings device", {
      timeout: 30_000,
    });
    await nameInput.fill("Kitchen frame");
    await expect(nameInput).toHaveValue("Kitchen frame");
    await page.getByRole("slider").press("ArrowRight");
    await expect(page.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "2 hours",
    );
    await page.getByText("Only update during allowed times").click();
    await page.getByLabel("From").fill("08:00");
    await page.getByLabel("Until").fill("17:00");
    await page.getByRole("button", { name: /Add window/ }).click();
    await expect(page.getByText("08:00 - 17:00").first()).toBeVisible();
    await page.getByText("Show overlay on picture frame").click();
    await captureMilestone(page, testInfo, "42-device-settings-edit.png");

    await page.getByTestId("crud-submit-button").click();

    await expect
      .poll(() => updatePayload)
      .toMatchObject({
        deviceId: testDeviceId,
        organization: createdOrganizationId,
        patient: null,
        meta: {
          name: "Kitchen frame",
          sleepTime: "7200",
          showOverlay: false,
          updateSchedule: {
            enabled: true,
            timezone: "Europe/Berlin",
            windows: [
              {
                durationMinutes: 540,
                repeat: "daily",
              },
            ],
          },
        },
      });
    await expect(
      page.getByText("The device has been successfully updated"),
    ).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("Kitchen frame", {
      timeout: 30_000,
    });
    await expect(page.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "2 hours",
    );
    await expect(
      page.locator("#settings-device-show-overlay"),
    ).not.toBeChecked();
    await expect(
      page.locator("#settings-device-update-schedule-enabled"),
    ).toBeChecked();
    await expect(page.getByText("08:00 - 17:00").first()).toBeVisible();
    await captureMilestone(page, testInfo, "43-device-settings-saved.png");
  });
});
