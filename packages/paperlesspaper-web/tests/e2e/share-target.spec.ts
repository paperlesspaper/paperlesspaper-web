import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { apiJson } from "./utils/api";

type DeviceResponse = {
  id: string;
};

type SharedImage = {
  uri: string;
  name: string;
  mimeType: string;
};

const testDeviceKind = "epd7";
const testPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAK0lEQVR4nGP8z8AARLJYBQjAwMDAwMDAYGdgYGBg+M+ABBgYGAIAF4cGB6TQXpAAAAAASUVORK5CYII=";

async function createTemporaryEpaperDevice(
  page: Page,
  request: APIRequestContext,
  organizationId: string,
) {
  return apiJson<DeviceResponse>(page, request, "/devices", {
    method: "POST",
    expectedStatus: 201,
    data: {
      kind: testDeviceKind,
      organization: organizationId,
      paper: null,
      patient: null,
    },
  });
}

async function openShareTarget(
  page: Page,
  shareTargetId: string,
  images: SharedImage[],
) {
  await page.addInitScript(
    ({ id, sharedImages }) => {
      window.sessionStorage.setItem(
        `paperlesspaper-share-target:${id}`,
        JSON.stringify({
          id,
          images: sharedImages,
          title: "Playwright shared image",
          texts: [],
          createdAt: Date.now(),
        }),
      );
    },
    { id: shareTargetId, sharedImages: images },
  );

  await page.goto(`/share-target?shareTargetId=${shareTargetId}`);
  await expect(
    page.getByRole("heading", { name: "Select target" }),
  ).toBeVisible({ timeout: 30_000 });
}

async function chooseShareTargetDestination(
  page: Page,
  organizationId: string,
  deviceId: string,
) {
  const organizationInput = page.locator(
    `input[name="shareTargetOrganization"][value="${organizationId}"]`,
  );
  const organizationInputId = await organizationInput.getAttribute("id");

  expect(organizationInputId).toBeTruthy();
  await page.locator(`label[for="${organizationInputId}"]`).click();

  await expect(
    page.locator(`input[name="shareTargetDevice"][value="${deviceId}"]`),
  ).toBeChecked({ timeout: 30_000 });
  await page.getByRole("button", { name: "Continue" }).click();
}

async function expectImageOnEditorCanvas(page: Page) {
  await expect
    .poll(
      async () =>
        page.locator("canvas").evaluateAll((canvases) =>
          canvases.some((canvas) => {
            const context = canvas.getContext("2d");
            if (!context || canvas.width === 0 || canvas.height === 0) {
              return false;
            }

            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;

            for (let index = 0; index < pixels.length; index += 40) {
              const alpha = pixels[index + 3];
              const red = pixels[index];
              const green = pixels[index + 1];
              const blue = pixels[index + 2];

              if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
                return true;
              }
            }

            return false;
          }),
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
}

test.describe("Native share target handoff", () => {
  let createdOrganizationId: string | undefined;
  let createdDeviceId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (createdDeviceId) {
      await apiJson(page, request, `/devices/${createdDeviceId}`, {
        method: "DELETE",
        expectedStatus: [200, 404],
      });
      createdDeviceId = undefined;
    }

    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId);
      createdOrganizationId = undefined;
    }
  });

  test("routes a single shared image to the image editor", async ({
    page,
    request,
  }) => {
    createdOrganizationId = await createTemporaryOrganization(page);
    const device = await createTemporaryEpaperDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    await openShareTarget(page, "single-image-share", [
      {
        uri: testPngDataUrl,
        name: "shared-single.png",
        mimeType: "image/png",
      },
    ]);
    await chooseShareTargetDestination(
      page,
      createdOrganizationId,
      createdDeviceId,
    );

    await expect(page).toHaveURL(
      new RegExp(
        `/${createdOrganizationId}/calendar/device/${createdDeviceId}/new/image\\?shareTargetId=single-image-share$`,
      ),
      { timeout: 30_000 },
    );
    await expectImageOnEditorCanvas(page);
  });

  test("routes multiple shared images to the multi image upload editor", async ({
    page,
    request,
  }) => {
    createdOrganizationId = await createTemporaryOrganization(page);
    const device = await createTemporaryEpaperDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    await openShareTarget(page, "multi-image-share", [
      {
        uri: testPngDataUrl,
        name: "shared-one.png",
        mimeType: "image/png",
      },
      {
        uri: testPngDataUrl,
        name: "shared-two.png",
        mimeType: "image/png",
      },
    ]);
    await chooseShareTargetDestination(
      page,
      createdOrganizationId,
      createdDeviceId,
    );

    await expect(page).toHaveURL(
      new RegExp(
        `/${createdOrganizationId}/calendar/device/${createdDeviceId}/new/image-multi-upload\\?shareTargetId=multi-image-share$`,
      ),
      { timeout: 30_000 },
    );
  });
});
