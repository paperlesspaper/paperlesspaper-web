import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs/promises";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { apiJson } from "./utils/api";
import { captureMilestone } from "./utils/screenshots";

type DeviceResponse = {
  id: string;
};

type PaperResponse = {
  id: string;
  kind: string;
  deviceId: string;
  meta?: Record<string, unknown>;
};

type PapersQueryResponse = {
  results: PaperResponse[];
};

type MultipartPart = {
  name: string;
  body: Buffer;
  contentType?: string;
};

type CapturedImageUpload = {
  generatedImage?: Buffer;
  previewImage?: Buffer;
  editableJson?: string;
};

type DownloadedImage = {
  body: Buffer;
  contentType: string;
};

const testDeviceKind = "paperlesspaper-e2e-test-device";
const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAK0lEQVR4nGP8z8AARLJYBQjAwMDAwMDAYGdgYGBg+M+ABBgYGAIAF4cGB6TQXpAAAAAASUVORK5CYII=",
  "base64",
);

function splitBuffer(buffer: Buffer, delimiter: Buffer) {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(delimiter);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

async function parseMultipartFormData(request: Request) {
  const contentType = request.headers()["content-type"] || "";
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  const body = request.postDataBuffer();

  if (!boundary || !body) return [];

  const delimiter = Buffer.from(`--${boundary}`);
  const rawParts = splitBuffer(body, delimiter).slice(1, -1);
  const parts: MultipartPart[] = [];

  for (const rawPart of rawParts) {
    const normalized = rawPart.subarray(rawPart.indexOf("\r\n") === 0 ? 2 : 0);
    const headerEnd = normalized.indexOf(Buffer.from("\r\n\r\n"));

    if (headerEnd === -1) continue;

    const headers = normalized.subarray(0, headerEnd).toString("utf8");
    const disposition = headers.match(/content-disposition:[^\r\n]+/i)?.[0];
    const name = disposition?.match(/name="([^"]+)"/)?.[1];

    if (!name) continue;

    const partContentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1];
    let partBody = normalized.subarray(headerEnd + 4);

    if (partBody.subarray(-2).toString("utf8") === "\r\n") {
      partBody = partBody.subarray(0, -2);
    }

    parts.push({
      name,
      body: Buffer.from(partBody),
      contentType: partContentType,
    });
  }

  return parts;
}

async function captureImageUpload(request: Request): Promise<CapturedImageUpload> {
  const parts = await parseMultipartFormData(request);
  const pictureParts = parts.filter((part) => part.name === "picture");
  const pngPictureParts = pictureParts.filter((part) =>
    part.body.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
  );
  const editablePart = parts.find((part) => part.name === "pictureEditable");

  return {
    generatedImage: pngPictureParts[0]?.body,
    previewImage: pngPictureParts[1]?.body,
    editableJson: editablePart?.body.toString("utf8"),
  };
}

async function attachGeneratedImage(
  testInfo: TestInfo,
  uploads: CapturedImageUpload[],
  name: string,
) {
  const latestUpload = uploads.at(-1);

  if (!latestUpload?.generatedImage) {
    throw new Error(`No generated image upload captured for ${name}`);
  }

  const path = testInfo.outputPath(name);

  await fs.writeFile(path, latestUpload.generatedImage);
  await testInfo.attach(name, {
    path,
    contentType: "image/png",
  });
}

async function attachImageBuffer(
  testInfo: TestInfo,
  image: DownloadedImage,
  name: string,
) {
  const path = testInfo.outputPath(name);

  await fs.writeFile(path, image.body);
  await testInfo.attach(name, {
    path,
    contentType: image.contentType,
  });
}

async function downloadImageSource(
  request: APIRequestContext,
  source: string,
) {
  if (!source.startsWith("http")) {
    throw new Error(`Expected a real signed image URL, got: ${source}`);
  }

  const response = await request.get(source);

  expect(response.ok()).toBeTruthy();

  return {
    body: await response.body(),
    contentType: response.headers()["content-type"]?.split(";")[0] || "image/png",
  };
}

async function attachSignedUrlImage(
  testInfo: TestInfo,
  request: APIRequestContext,
  source: string | null,
  name: string,
) {
  if (!source) {
    throw new Error(`No signed URL image source captured for ${name}`);
  }

  await attachImageBuffer(
    testInfo,
    await downloadImageSource(request, source),
    name,
  );
}

async function captureRealImageUploads(
  page: Page,
  capturedUploads: CapturedImageUpload[] = [],
) {
  await page.route(/\/papers\/uploadSingleImage\//, async (route) => {
    capturedUploads.push(await captureImageUpload(route.request()));
    await route.continue();
  });
}

async function expectImageEditorReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Loading...").first()).toBeHidden({
    timeout: 30_000,
  });
}

async function sendImageEditorToFrame(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Send to frame" })).toBeVisible(
    { timeout: 30_000 },
  );
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/papers/uploadSingleImage/") &&
      response.request().method() === "POST",
    { timeout: 120_000 },
  );
  await page.getByRole("button", { name: "Send" }).click();
  const response = await uploadResponse;
  const responseText = response.ok() ? "" : await response.text();
  expect(
    response.ok(),
    `image upload should succeed (${response.status()} ${response.url()}): ${responseText}`,
  ).toBeTruthy();
}

async function setValueChanger(
  page: Page,
  name: string,
  value: string,
  displayedValue = value,
) {
  const slider = page.getByRole("slider", { name });

  await expect(slider).toBeVisible({ timeout: 30_000 });
  await slider.fill(value);
  await expect(slider).toHaveValue(value);
  await expect(page.locator('output[aria-live="polite"]').last()).toHaveText(
    displayedValue,
  );
}

async function expectDeviceOverviewImage(
  page: Page,
  organizationId: string,
  deviceId: string,
) {
  await expect(page).toHaveURL(
    new RegExp(`/${organizationId}/library/device/${deviceId}/?$`),
    { timeout: 30_000 },
  );

  const overviewImage = page
    .getByRole("img", { name: /^(Preview of the eink display|image)$/ })
    .last();

  await expect(overviewImage).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => {
      return overviewImage.evaluate((image: HTMLImageElement) =>
        image.complete ? image.naturalWidth : 0,
      );
    })
    .toBeGreaterThan(0);

  return overviewImage.getAttribute("src");
}

async function getOrganizationPapers(
  page: Page,
  request: APIRequestContext,
  organizationId: string,
) {
  return apiJson<PapersQueryResponse>(
    page,
    request,
    `/papers?organization=${organizationId}`,
  );
}

async function createTemporaryTestDevice(
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

async function openNewSingleImageEditor(
  page: Page,
  organizationId: string,
  deviceId: string,
) {
  await page.goto(
    `/${organizationId}/library/device/${deviceId}/new/image?frameKind=${testDeviceKind}`,
  );
  await expectImageEditorReady(page);
}

test.describe("Paper lifecycle", () => {
  let createdOrganizationId: string | undefined;
  let createdDeviceId: string | undefined;
  let createdPaperId: string | undefined;

  test.afterEach(async ({ page, request }) => {
    if (createdPaperId) {
      await apiJson(page, request, `/papers/${createdPaperId}`, {
        method: "DELETE",
        expectedStatus: [200, 404],
      });
      createdPaperId = undefined;
    }

    if (createdDeviceId) {
      await apiJson(page, request, `/devices/${createdDeviceId}`, {
        method: "DELETE",
        expectedStatus: [200, 404],
      });
      createdDeviceId = undefined;
    }

    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId, request);
      createdOrganizationId = undefined;
    }
  });

  test("adds, updates, and deletes a paper in the single image editor", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const imageUploads: CapturedImageUpload[] = [];

    await captureRealImageUploads(page, imageUploads);
    createdOrganizationId = await createTemporaryOrganization(page);

    const device = await createTemporaryTestDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    await openNewSingleImageEditor(
      page,
      createdOrganizationId,
      createdDeviceId,
    );
    await page.getByRole("button", { name: "Rectangle" }).click();
    await captureMilestone(page, testInfo, "09-single-image-editor-new.png");
    await sendImageEditorToFrame(page);
    const createdSignedUrlImage = await expectDeviceOverviewImage(
      page,
      createdOrganizationId,
      createdDeviceId,
    );
    await attachGeneratedImage(
      testInfo,
      imageUploads,
      "09-generated-paper.png",
    );
    await attachSignedUrlImage(
      testInfo,
      request,
      createdSignedUrlImage,
      "09-signed-url-paper.png",
    );

    await expect
      .poll(async () => {
        const papers = await getOrganizationPapers(
          page,
          request,
          createdOrganizationId!,
        );
        return papers.results.find(
          (paper) =>
            paper.deviceId === createdDeviceId && paper.kind === "image",
        );
      })
      .toBeTruthy();

    const papersAfterCreate = await getOrganizationPapers(
      page,
      request,
      createdOrganizationId,
    );
    createdPaperId = papersAfterCreate.results.find(
      (paper) => paper.deviceId === createdDeviceId && paper.kind === "image",
    )?.id;

    expect(createdPaperId).toBeTruthy();
    await page.goto(`/${createdOrganizationId}/library`);
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "No pictures yet" }),
    ).toBeHidden();
    await captureMilestone(page, testInfo, "09-paper-created.png");

    await page.goto(
      `/${createdOrganizationId}/library/device/${createdDeviceId}/${createdPaperId}?frameKind=${testDeviceKind}`,
    );
    await expectImageEditorReady(page);
    await page.getByRole("button", { name: "Text" }).click();
    await captureMilestone(page, testInfo, "10-single-image-editor-update.png");
    await sendImageEditorToFrame(page);
    const updatedSignedUrlImage = await expectDeviceOverviewImage(
      page,
      createdOrganizationId,
      createdDeviceId,
    );
    await attachSignedUrlImage(
      testInfo,
      request,
      updatedSignedUrlImage,
      "10-signed-url-paper-updated.png",
    );
    await captureMilestone(page, testInfo, "10-paper-updated.png");

    await page.goto(
      `/${createdOrganizationId}/library/device/${createdDeviceId}/${createdPaperId}?frameKind=${testDeviceKind}`,
    );
    await expectImageEditorReady(page);
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete" })).toBeVisible({
      timeout: 30_000,
    });
    await page
      .locator(".wfp--modal.is-visible")
      .filter({ has: page.getByRole("heading", { name: "Delete" }) })
      .getByRole("button", { name: "Delete" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: "Delete successful" }),
    ).toBeVisible({ timeout: 30_000 });
    const deletedPaperId = createdPaperId;
    createdPaperId = undefined;
    await page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: "Delete successful" }) })
      .getByRole("button", { name: "Continue" })
      .click();

    const papers = await apiJson<PapersQueryResponse>(
      page,
      request,
      `/papers?organization=${createdOrganizationId}`,
    );
    expect(papers.results.map((paper) => paper.id)).not.toContain(
      deletedPaperId,
    );

    await page.goto(`/${createdOrganizationId}/library`);
    await expect(
      page.getByRole("heading", { name: "No pictures yet" }),
    ).toBeVisible({ timeout: 30_000 });
    await captureMilestone(page, testInfo, "11-paper-deleted.png");
  });

  test("uses single image editor tools before sending a paper", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(75_000);
    const imageUploads: CapturedImageUpload[] = [];

    await captureRealImageUploads(page, imageUploads);
    createdOrganizationId = await createTemporaryOrganization(page);

    const device = await createTemporaryTestDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    await openNewSingleImageEditor(
      page,
      createdOrganizationId,
      createdDeviceId,
    );

    await page.locator("#uploader").setInputFiles({
      name: "paperlesspaper-e2e.png",
      mimeType: "image/png",
      buffer: testPng,
    });
    await expect(page.getByRole("button", { name: "Size" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Size" }).click();
    await page.getByRole("button", { name: "Cover" }).click();
    await page.getByRole("button", { name: "Brightness" }).click();
    await setValueChanger(page, "Brightness", "0.2", "+0.20");
    await captureMilestone(page, testInfo, "12-single-image-editor-photo.png");

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: "Photo" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "Rectangle" }).click();
    await expect(page.getByRole("button", { name: "Forward" })).toBeVisible();
    await page.getByRole("button", { name: "Color" }).click();
    await page.getByRole("button", { name: "Backward" }).click();
    await page.getByRole("button", { name: "Forward" }).click();
    await captureMilestone(
      page,
      testInfo,
      "13-single-image-editor-object-tools.png",
    );
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: "QR" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "QR" }).click();
    await expect(page.getByRole("heading", { name: "Change" })).toBeVisible({
      timeout: 30_000,
    });
    const qrDialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: "Change" }) });
    await qrDialog
      .getByRole("textbox")
      .fill("https://paperlesspaper.test/e2e");
    await expect(page.getByRole("button", { name: "Change" })).toBeVisible({
      timeout: 30_000,
    });
    await captureMilestone(page, testInfo, "14-single-image-editor-qr.png");
    await qrDialog.locator("button").first().click();
    await expect(qrDialog).toBeHidden({ timeout: 30_000 });
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByRole("button", { name: "Draw" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Draw" }).click();
    await expect(page.getByRole("button", { name: "Line width" })).toBeVisible(
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: "Line width" }).click();
    await setValueChanger(page, "Line width", "8");
    await captureMilestone(page, testInfo, "15-single-image-editor-draw.png");
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByRole("button", { name: "Rotate" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Rotate" }).click();

    await sendImageEditorToFrame(page);
    const toolsSignedUrlImage = await expectDeviceOverviewImage(
      page,
      createdOrganizationId,
      createdDeviceId,
    );
    await attachGeneratedImage(
      testInfo,
      imageUploads,
      "16-generated-paper-tools.png",
    );
    await attachSignedUrlImage(
      testInfo,
      request,
      toolsSignedUrlImage,
      "16-signed-url-paper-tools.png",
    );

    await expect
      .poll(async () => {
        const papers = await getOrganizationPapers(
          page,
          request,
          createdOrganizationId!,
        );
        return papers.results.find(
          (paper) =>
            paper.deviceId === createdDeviceId && paper.kind === "image",
        );
      })
      .toBeTruthy();

    const papersAfterCreate = await getOrganizationPapers(
      page,
      request,
      createdOrganizationId,
    );
    createdPaperId = papersAfterCreate.results.find(
      (paper) => paper.deviceId === createdDeviceId && paper.kind === "image",
    )?.id;

    expect(createdPaperId).toBeTruthy();
    await captureMilestone(page, testInfo, "16-single-image-editor-sent.png");
  });
});
