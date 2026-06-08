import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { apiJson } from "./utils/api";
import { expectGroupSelectionOrOnboarding } from "./utils/app";
import { captureMilestone } from "./utils/screenshots";

type DeviceRecord = {
  id: string;
  deviceId: string;
  kind?: string;
  organization?: string;
};

type DevicesQueryResponse = {
  results: DeviceRecord[];
};

type OrganizationsQueryResponse = {
  results: Array<{ id: string }>;
};

type AdminSearchResponse = {
  devices?: Array<
    DeviceRecord & {
      organization?: string | { id?: string };
    }
  >;
};

type WebcamFrame = {
  dataUrl: string;
  pixels: number[];
  width: number;
  height: number;
};

type TestCard = {
  buffer: Buffer;
  cells: PaletteColor[];
  columns: number;
  rows: number;
  runId: string;
};

type PaletteColor = "black" | "white" | "red" | "yellow";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as any;

const defaultPhysicalDeviceId = "epd7-b43a459b7ec4";
const physicalDeviceId =
  process.env.PLAYWRIGHT_REAL_DEVICE_ID ?? defaultPhysicalDeviceId;
const physicalDeviceObjectId = process.env.PLAYWRIGHT_REAL_DEVICE_OBJECT_ID;
const physicalDeviceOrganizationId =
  process.env.PLAYWRIGHT_REAL_DEVICE_ORGANIZATION_ID;
const webcamDiffThreshold = Number(
  process.env.PLAYWRIGHT_WEBCAM_DIFF_THRESHOLD ?? "8",
);
const webcamCardMatchThreshold = Number(
  process.env.PLAYWRIGHT_WEBCAM_CARD_MATCH_THRESHOLD ?? "0.62",
);
const displaySettleWaitMs = Number(
  process.env.PLAYWRIGHT_REAL_DEVICE_DISPLAY_SETTLE_WAIT_MS ?? "50000",
);
const updateWaitMs = Number(
  process.env.PLAYWRIGHT_REAL_DEVICE_UPDATE_WAIT_MS ?? "180000",
);
const organizationIdPattern = /^[a-f\d]{24}$/i;
const palette: Record<PaletteColor, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [220, 30, 30],
  yellow: [245, 210, 35],
};
const paletteNames = Object.keys(palette) as PaletteColor[];

function hashString(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function makeFrameTestImage(runId: string): TestCard {
  const width = 800;
  const height = 480;
  const columns = 8;
  const rows = 5;
  const png = new PNG({ width, height });
  const cells: PaletteColor[] = [];
  const seed = hashString(runId);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const value =
        (seed >>> ((row * 7 + column * 3) % 24)) + row * 11 + column * 17;
      const color = paletteNames[value % paletteNames.length];

      cells.push(color);
    }
  }

  cells[0] = "black";
  cells[1] = "yellow";
  cells[columns - 2] = "red";
  cells[columns - 1] = "white";
  cells[cells.length - columns] = "red";
  cells[cells.length - 1] = "black";

  for (let y = 0; y < height; y += 1) {
    const row = Math.min(rows - 1, Math.floor((y / height) * rows));

    for (let x = 0; x < width; x += 1) {
      const column = Math.min(columns - 1, Math.floor((x / width) * columns));
      const color = palette[cells[row * columns + column]];
      const index = (width * y + x) << 2;

      png.data[index] = color[0];
      png.data[index + 1] = color[1];
      png.data[index + 2] = color[2];
      png.data[index + 3] = 255;
    }
  }

  for (let y = 24; y < height - 24; y += 1) {
    for (let x = 24; x < width - 24; x += 1) {
      if (x > 48 && x < width - 48 && y > 48 && y < height - 48) continue;

      const index = (width * y + x) << 2;
      png.data[index] = 0;
      png.data[index + 1] = 0;
      png.data[index + 2] = 0;
    }
  }

  return {
    buffer: PNG.sync.write(png) as Buffer,
    cells,
    columns,
    rows,
    runId,
  };
}

function frameDifference(a: WebcamFrame, b: WebcamFrame) {
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  expect(a.pixels.length).toBe(b.pixels.length);

  let total = 0;
  let compared = 0;

  for (let index = 0; index < a.pixels.length; index += 4) {
    total += Math.abs(a.pixels[index] - b.pixels[index]);
    total += Math.abs(a.pixels[index + 1] - b.pixels[index + 1]);
    total += Math.abs(a.pixels[index + 2] - b.pixels[index + 2]);
    compared += 3;
  }

  return total / compared;
}

async function saveAndAttachBuffer(
  testInfo: TestInfo,
  buffer: Buffer,
  name: string,
  contentType = "image/png",
) {
  const path = testInfo.outputPath(name);

  await fs.writeFile(path, buffer);
  await testInfo.attach(name, {
    path,
    contentType,
  });
}

async function saveAndAttachWebcamFrame(
  testInfo: TestInfo,
  frame: WebcamFrame,
  name: string,
) {
  await saveAndAttachBuffer(
    testInfo,
    Buffer.from(frame.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"),
    name,
  );
}

async function captureWebcamFrame(page: Page): Promise<WebcamFrame> {
  return page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      const width = 320;
      const height = 240;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not create webcam capture canvas.");
      }

      context.drawImage(video, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);

      return {
        dataUrl: canvas.toDataURL("image/png"),
        pixels: Array.from(imageData.data),
        width,
        height,
      };
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
  });
}

function classifyColor(red: number, green: number, blue: number): PaletteColor {
  let bestColor: PaletteColor = "white";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const colorName of paletteNames) {
    const color = palette[colorName];
    const distance =
      (red - color[0]) ** 2 + (green - color[1]) ** 2 + (blue - color[2]) ** 2;

    if (distance < bestDistance) {
      bestColor = colorName;
      bestDistance = distance;
    }
  }

  return bestColor;
}

function sampledColor(
  frame: WebcamFrame,
  sampleX: number,
  sampleY: number,
): PaletteColor {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (
    let y = Math.max(0, sampleY - 2);
    y <= Math.min(frame.height - 1, sampleY + 2);
    y += 1
  ) {
    for (
      let x = Math.max(0, sampleX - 2);
      x <= Math.min(frame.width - 1, sampleX + 2);
      x += 1
    ) {
      const index = (frame.width * y + x) << 2;

      red += frame.pixels[index];
      green += frame.pixels[index + 1];
      blue += frame.pixels[index + 2];
      count += 1;
    }
  }

  return classifyColor(red / count, green / count, blue / count);
}

function range(start: number, end: number, step: number) {
  const values: number[] = [];

  for (let value = start; value <= end + 0.0001; value += step) {
    values.push(Number(value.toFixed(4)));
  }

  return values;
}

function evaluateTestCardMatch(frame: WebcamFrame, card: TestCard) {
  const orientations = [
    {
      name: "normal",
      aspectRatio: card.columns / card.rows,
      point: (column: number, row: number) => ({
        x: (column + 0.5) / card.columns,
        y: (row + 0.5) / card.rows,
      }),
    },
    {
      name: "rotated-180",
      aspectRatio: card.columns / card.rows,
      point: (column: number, row: number) => ({
        x: (card.columns - column - 0.5) / card.columns,
        y: (card.rows - row - 0.5) / card.rows,
      }),
    },
    {
      name: "rotated-cw",
      aspectRatio: card.rows / card.columns,
      point: (column: number, row: number) => ({
        x: (card.rows - row - 0.5) / card.rows,
        y: (column + 0.5) / card.columns,
      }),
    },
    {
      name: "rotated-ccw",
      aspectRatio: card.rows / card.columns,
      point: (column: number, row: number) => ({
        x: (row + 0.5) / card.rows,
        y: (card.columns - column - 0.5) / card.columns,
      }),
    },
  ];
  let best = {
    score: 0,
    matched: 0,
    orientation: "none",
    rect: { left: 0, top: 0, width: 0, height: 0 },
    total: card.cells.length,
  };

  for (const orientation of orientations) {
    for (const widthRatio of range(0.18, 1, 0.04)) {
      const rectWidth = frame.width * widthRatio;
      const rectHeight = rectWidth / orientation.aspectRatio;

      if (rectHeight > frame.height || rectHeight < 24) continue;

      for (const centerXRatio of range(0.12, 0.9, 0.04)) {
        for (const centerYRatio of range(0.12, 0.9, 0.04)) {
          const left = frame.width * centerXRatio - rectWidth / 2;
          const top = frame.height * centerYRatio - rectHeight / 2;

          if (
            left < 0 ||
            top < 0 ||
            left + rectWidth > frame.width ||
            top + rectHeight > frame.height
          ) {
            continue;
          }

          let matched = 0;

          for (let row = 0; row < card.rows; row += 1) {
            for (let column = 0; column < card.columns; column += 1) {
              const point = orientation.point(column, row);
              const sampleX = Math.round(left + point.x * rectWidth);
              const sampleY = Math.round(top + point.y * rectHeight);
              const expected = card.cells[row * card.columns + column];
              const actual = sampledColor(frame, sampleX, sampleY);

              if (actual === expected) {
                matched += 1;
              }
            }
          }

          const score = matched / card.cells.length;

          if (score > best.score) {
            best = {
              score,
              matched,
              orientation: orientation.name,
              rect: {
                left: Math.round(left),
                top: Math.round(top),
                width: Math.round(rectWidth),
                height: Math.round(rectHeight),
              },
              total: card.cells.length,
            };
          }
        }
      }
    }
  }

  return best;
}

async function findPhysicalDevice(
  page: Page,
  request: APIRequestContext,
): Promise<DeviceRecord> {
  if (physicalDeviceObjectId) {
    return apiJson<DeviceRecord>(
      page,
      request,
      `/devices/${physicalDeviceObjectId}`,
    );
  }

  const organizationIds = new Set<string>();

  if (physicalDeviceOrganizationId) {
    organizationIds.add(physicalDeviceOrganizationId);
  }

  const currentPathOrganizationId = new URL(page.url()).pathname.split("/")[1];

  if (organizationIdPattern.test(currentPathOrganizationId || "")) {
    organizationIds.add(currentPathOrganizationId);
  }

  const pageOrganizationIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((link) => {
        try {
          return new URL(link.href).pathname.split("/")[1] || "";
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );

  pageOrganizationIds
    .filter((organizationId) => organizationIdPattern.test(organizationId))
    .forEach((organizationId) => organizationIds.add(organizationId));

  const organizations = await apiJson<OrganizationsQueryResponse>(
    page,
    request,
    "/organizations",
  );

  organizations.results
    .map((organization) => organization.id)
    .filter((organizationId) => organizationIdPattern.test(organizationId))
    .forEach((organizationId) => organizationIds.add(organizationId));

  if (!organizationIds.size) {
    throw new Error(
      "Could not infer an organization to search for the physical device. Set PLAYWRIGHT_REAL_DEVICE_ORGANIZATION_ID.",
    );
  }

  for (const organizationId of organizationIds) {
    const searchParams = new URLSearchParams({
      organization: organizationId,
      search: physicalDeviceId,
    });
    const devices = await apiJson<DevicesQueryResponse>(
      page,
      request,
      `/devices?${searchParams.toString()}`,
    );
    const device = devices.results.find(
      (entry) => entry.deviceId === physicalDeviceId,
    );

    if (device) {
      return device;
    }
  }

  const adminSearchParams = new URLSearchParams({
    limit: "10",
    search: physicalDeviceId,
  });
  const adminSearch = await apiJson<AdminSearchResponse>(
    page,
    request,
    `/admin/search?${adminSearchParams.toString()}`,
    { expectedStatus: [200, 401, 403] },
  );
  const adminDevice = adminSearch.devices?.find(
    (entry) => entry.deviceId === physicalDeviceId,
  );

  if (adminDevice) {
    const organization =
      typeof adminDevice.organization === "string"
        ? adminDevice.organization
        : adminDevice.organization?.id;

    return {
      id: adminDevice.id,
      deviceId: adminDevice.deviceId,
      kind: adminDevice.kind,
      organization,
    };
  }

  throw new Error(
    `Could not find physical ePaper device ${physicalDeviceId}. Set PLAYWRIGHT_REAL_DEVICE_ORGANIZATION_ID or PLAYWRIGHT_REAL_DEVICE_OBJECT_ID if it is not in the current group list.`,
  );
}

async function expectImageEditorReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Loading...").first()).toBeHidden({
    timeout: 60_000,
  });
}

async function sendImageEditorToFrame(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: /^Send to(?: frame)?$/ }),
  ).toBeVisible({ timeout: 30_000 });

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
    `physical frame image upload should succeed (${response.status()} ${response.url()}): ${responseText}`,
  ).toBeTruthy();
}

test.describe("Physical ePaper frame image update", () => {
  test("updates the real frame and verifies the unique webcam image", async ({
    context,
    page,
    request,
  }, testInfo) => {
    test.setTimeout(displaySettleWaitMs + updateWaitMs + 180_000);
    test.skip(
      process.env.PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION !== "1",
      "Set PLAYWRIGHT_ALLOW_REAL_DEVICE_MUTATION=1 to send an image to the physical frame.",
    );

    await context.grantPermissions(["camera"]);
    await page.goto("/");
    await expectGroupSelectionOrOnboarding(page);

    const device = await findPhysicalDevice(page, request);

    expect(
      device.organization,
      "Physical device must belong to an organization.",
    ).toBeTruthy();

    const beforeFrame = await captureWebcamFrame(page);
    await saveAndAttachWebcamFrame(
      testInfo,
      beforeFrame,
      "physical-frame-before-webcam.png",
    );

    await page.goto(
      `/${device.organization}/library/device/${device.id}/new/image?frameKind=${device.kind || "epd7"}`,
    );
    await expectImageEditorReady(page);
    const card = makeFrameTestImage(Date.now().toString(36));
    await saveAndAttachBuffer(
      testInfo,
      card.buffer,
      `physical-frame-expected-${card.runId}.png`,
    );
    await page.locator("#uploader").setInputFiles({
      name: `physical-frame-${card.runId}.png`,
      mimeType: "image/png",
      buffer: card.buffer,
    });
    await expect(page.getByRole("button", { name: "Size" })).toBeVisible({
      timeout: 30_000,
    });
    await captureMilestone(page, testInfo, "physical-frame-editor.png");

    await sendImageEditorToFrame(page);
    await captureMilestone(page, testInfo, "physical-frame-sent.png");

    await page.waitForTimeout(displaySettleWaitMs);
    const afterFrame = await captureWebcamFrame(page);
    const diff = frameDifference(beforeFrame, afterFrame);
    const cardMatch = evaluateTestCardMatch(afterFrame, card);

    await saveAndAttachWebcamFrame(
      testInfo,
      afterFrame,
      "physical-frame-after-webcam.png",
    );

    expect(
      diff,
      `Expected webcam image to change after updating ${device.deviceId}. Increase PLAYWRIGHT_REAL_DEVICE_UPDATE_WAIT_MS if the frame had not refreshed yet.`,
    ).toBeGreaterThanOrEqual(webcamDiffThreshold);
    expect(
      cardMatch.score,
      `Expected webcam image to match the unique ePaper test card ${card.runId}. Matched ${cardMatch.matched}/${cardMatch.total} sampled cells using ${cardMatch.orientation} at ${JSON.stringify(cardMatch.rect)}.`,
    ).toBeGreaterThanOrEqual(webcamCardMatchThreshold);
  });
});
