import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { apiJson } from "./utils/api";
import { captureMilestone } from "./utils/screenshots";

type RegisterDeviceResponse = {
  activation_status?: string;
  createdDevice?: {
    id: string;
    deviceId: string;
  };
  device?: {
    id: string;
    deviceId: string;
  };
};

type DevicesQueryResponse = {
  results: Array<{
    id: string;
    deviceId: string;
    kind?: string;
  }>;
};

const testDeviceId =
  process.env.PLAYWRIGHT_REAL_DEVICE_ID ?? "epd7-b43a459a1b98";

test.describe("Device registration", () => {
  let createdOrganizationId: string | undefined;
  let registeredDeviceObjectId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (
      registeredDeviceObjectId &&
      process.env.PLAYWRIGHT_DELETE_REAL_DEVICE_AFTER === "1"
    ) {
      await apiJson(page, request, `/devices/${registeredDeviceObjectId}`, {
        method: "DELETE",
        expectedStatus: [200, 404],
      });
      registeredDeviceObjectId = undefined;
    }

    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId, request);
      createdOrganizationId = undefined;
    }
  });

  test("adds the epd7 test device through the UI with Wi-Fi skipped", async ({
    page,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    await page.route(/\/devices\/registerdevice\//, async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          activation_status: "success",
          createdDevice: {
            id: "507f1f77bcf86cd799439011",
            deviceId: testDeviceId,
            kind: "epd7",
            organization: createdOrganizationId,
          },
        }),
      });
    });

    await page.goto(
      `/${createdOrganizationId}/devices/new?e2eSkipWifiProvisioning=1`,
    );
    await expect(
      page
        .getByRole("heading", { name: /Register new device|Gerät aktivieren/ })
        .or(page.getByText(/Register new device|Gerät aktivieren/))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await captureMilestone(page, testInfo, "12-device-add-form.png");

    await page.getByText("Or type code").click();
    await page.getByPlaceholder("16 to 19-digit code").fill(testDeviceId);
    await page.getByRole("button", { name: "Add device" }).click();

    await expect(page.getByText("Device successfully activated")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: "Upload first image" }),
    ).toBeVisible();
    await captureMilestone(page, testInfo, "13-device-registered.png");
  });

  test("registers the real epd7 device against a blank local API", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      process.env.PLAYWRIGHT_USE_LOCAL_API !== "1",
      "Real device registration is only allowed against the local blank API.",
    );
    test.skip(
      process.env.PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION !== "1",
      "Set PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 to activate the physical test device.",
    );

    createdOrganizationId = await createTemporaryOrganization(page);

    const registration = await apiJson<RegisterDeviceResponse>(
      page,
      request,
      `/devices/registerdevice/${testDeviceId}`,
      {
        method: "POST",
        expectedStatus: [201, 409],
        data: {
          enable: true,
          organization: createdOrganizationId,
          patient: null,
          paper: null,
        },
      },
    );

    registeredDeviceObjectId =
      registration.createdDevice?.id || registration.device?.id;

    expect(
      registration.activation_status ||
        registration.createdDevice?.deviceId ||
        registration.device?.deviceId,
    ).toBeTruthy();

    const devices = await apiJson<DevicesQueryResponse>(
      page,
      request,
      `/devices?organization=${createdOrganizationId}`,
    );
    expect(devices.results.map((device) => device.deviceId)).toContain(
      testDeviceId,
    );

    await page.goto(`/${createdOrganizationId}/devices`);
    await expect(page.getByText("Devices")).toBeVisible({ timeout: 30_000 });
    await captureMilestone(page, testInfo, "14-device-registered.png");
  });
});
