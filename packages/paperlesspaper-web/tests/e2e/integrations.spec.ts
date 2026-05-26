import {
  expect,
  test,
  type APIRequestContext,
  type Page,
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
  imageUpdatedAt?: string;
};

type PapersQueryResponse = {
  results: PaperResponse[];
};

type SignedImageResponse = {
  signedUrl?: string;
  url?: string;
};

const testDeviceKind = "paperlesspaper-e2e-test-device";
const xkcdOpenIntegrationConfigUrl =
  "https://openintegration-dailyxkcd-gamma.vercel.app/config.json";
const integrationRenderLockPath = "/tmp/paperlesspaper-integration-render.lock";
const shouldRunLocalApiRenderE2E =
  process.env.PLAYWRIGHT_USE_LOCAL_API !== "1" ||
  process.env.PLAYWRIGHT_RUN_RENDER_E2E === "1";

async function acquireIntegrationRenderLock() {
  const timeoutAt = Date.now() + 120_000;

  while (Date.now() < timeoutAt) {
    try {
      const lock = await fs.open(integrationRenderLockPath, "wx");
      await lock.writeFile(`${process.pid}`);

      return async () => {
        await lock.close();
        await fs.rm(integrationRenderLockPath, { force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      let lockStat;
      try {
        lockStat = await fs.stat(integrationRenderLockPath);
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw statError;
      }

      if (Date.now() - lockStat.mtimeMs > 5 * 60_000) {
        await fs.rm(integrationRenderLockPath, { force: true });
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error("Timed out waiting for integration render test lock.");
}

const editorSmokeCases = [
  {
    kind: "website",
    heading: "Display website",
    control: "Website",
    screenshot: "17-integration-website.png",
  },
  {
    kind: "rss",
    heading: "Display RSS-Feed",
    control: "RSS-Feed",
    screenshot: "18-integration-rss.png",
  },
  {
    kind: "calendar",
    heading: "Display calendar",
    control: "Settings",
    screenshot: "19-integration-calendar.png",
  },
  {
    kind: "weather",
    heading: "Display Weather",
    control: "Settings",
    screenshot: "20-integration-weather.png",
  },
  {
    kind: "wikipedia",
    heading: "Wikipedia Article of the day",
    control: "Settings",
    screenshot: "21-integration-wikipedia.png",
  },
  {
    kind: "days-left",
    heading: "Days left",
    control: "Settings",
    screenshot: "22-integration-days-left.png",
  },
  {
    kind: "days-since",
    heading: "Days since",
    control: "Settings",
    screenshot: "23-integration-days-since.png",
  },
  {
    kind: "sunrise",
    heading: "Sunrise & Sunset",
    control: "Settings",
    screenshot: "24-integration-sunrise.png",
  },
  {
    kind: "baby",
    heading: "Display calendar",
    control: "Settings",
    screenshot: "25-integration-baby.png",
  },
  {
    kind: "apothekennotdienst",
    heading: "Apotheken-Notdienst",
    control: "Settings",
    screenshot: "26-integration-apotheken.png",
  },
  {
    kind: "movies",
    heading: "Upcoming Movies",
    control: "Settings",
    screenshot: "27-integration-movies.png",
  },
  {
    kind: "slides",
    heading: "Display Slideshow",
    control: "Select slides",
    screenshot: "28-integration-slides.png",
  },
  {
    kind: "printer",
    heading: "Printer",
    control: "Instructions",
    screenshot: "29-integration-printer.png",
  },
];

const sendCases = [
  {
    kind: "calendar",
    heading: "Display calendar",
    screenshot: "30-integration-calendar-sent.png",
    signedUrlArtifact: "30-integration-calendar-signed-url.png",
  },
  {
    kind: "website",
    heading: "Display website",
    screenshot: "31-integration-website-sent.png",
    signedUrlArtifact: "31-integration-website-signed-url.png",
    configure: async (page: Page) => {
      await page.getByRole("button", { name: "Website", exact: true }).click();
      const dialog = page.getByRole("dialog").filter({
        has: page.getByText("Enter an URL to display on the epaper"),
      });
      await dialog.getByRole("textbox").fill("https://zeit.de");
      await dialog.getByRole("button", { name: "Continue" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
    },
  },
  {
    kind: "weather",
    heading: "Display Weather",
    screenshot: "32-integration-weather-sent.png",
    signedUrlArtifact: "32-integration-weather-signed-url.png",
    configure: async (page: Page) => {
      await page.getByRole("button", { name: "Settings" }).click();
      const dialog = page.getByRole("dialog").filter({
        has: page.getByText("Enter the location you want to display"),
      });
      await dialog.getByRole("textbox").fill("Berlin");
      await dialog.getByRole("button", { name: "Continue" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
    },
  },
];

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

async function openIntegrationEditor(
  page: Page,
  organizationId: string,
  deviceId: string,
  kind: string,
  extraQuery: Record<string, string> = {},
) {
  const query = new URLSearchParams({
    frameKind: testDeviceKind,
    ...extraQuery,
  });

  const url = `/${organizationId}/library/device/${deviceId}/new/${kind}?${query.toString()}`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("ERR_NETWORK_IO_SUSPENDED")
    ) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      return;
    }

    throw error;
  }
}

async function installOpenIntegrationRoutes(page: Page) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3200";
  const configUrl = new URL(
    "/__e2e-open-integration/config.json",
    baseURL,
  ).toString();

  await page.route("**/__e2e-open-integration/config.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        name: "E2E Open Plugin",
        version: "1.0.0",
        description: "Playwright-controlled Open Integration test plugin",
        nativeSettings: {
          orientation: "portrait",
          quality: 1,
        },
        formSchema: {
          type: "object",
          required: ["headline"],
          properties: {
            headline: {
              type: "string",
              description: "Headline",
              default: "Open Integration E2E",
            },
            accent: {
              type: "string",
              description: "Accent",
              enum: ["green", "blue", "gray"],
              default: "green",
            },
            showTimestamp: {
              type: "boolean",
              description: "Show timestamp",
              default: true,
            },
          },
        },
        settingsPage: "/__e2e-open-integration/settings.html",
        renderPage: "/__e2e-open-integration/render.html",
      }),
    });
  });

  await page.route("**/__e2e-open-integration/settings.html", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Open Integration Settings</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; color: #17202a; background: #f7fbf8; }
      main { border: 1px solid #7fbf90; background: #fff; padding: 18px; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      p { margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Open Integration Settings</h1>
      <p id="payload">Waiting for initialization</p>
      <button id="apply">Apply iframe settings</button>
    </main>
    <script>
      function send(type, payload) {
        parent.postMessage({ source: "paperlesspaper-plugin", type, payload }, "*");
      }

      window.addEventListener("message", (event) => {
        const data = event.data || {};
        const payload = data.payload || data.data || {};
        if (data.type === "INIT" || data.cmd === "message") {
          document.getElementById("payload").textContent = "Initialized for " + (payload.device?.kind || "unknown device");
          send("SET_HEIGHT", { height: 320 });
        }
      });

      document.getElementById("apply").addEventListener("click", () => {
        send("UPDATE_SETTINGS", {
          iframeConfirmed: true,
          headline: "Open Integration from iframe"
        });
      });
    </script>
  </body>
</html>`,
    });
  });

  await page.route("**/__e2e-open-integration/render.html", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Open Integration Render</title>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: #fff; color: #111; font-family: system-ui, sans-serif; }
      body { display: grid; place-items: center; }
      h1 { font-size: 64px; line-height: 1; max-width: 720px; text-align: center; }
    </style>
  </head>
  <body>
    <h1>Open Integration E2E</h1>
  </body>
</html>`,
    });
  });

  return { configUrl };
}

async function sendIntegrationToFrame(page: Page) {
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
    `integration upload should succeed (${response.status()} ${response.url()}): ${responseText}`,
  ).toBeTruthy();
}

async function expectDeviceOverviewImage(
  page: Page,
  request: APIRequestContext,
  organizationId: string,
  deviceId: string,
  kind: string,
) {
  await expect(page).toHaveURL(
    new RegExp(`/${organizationId}/library/device/${deviceId}/?$`),
    { timeout: 30_000 },
  );

  const paperId = await expectRenderedPaperId(
    page,
    request,
    organizationId,
    deviceId,
    kind,
  );
  const signedUrl = await expectGeneratedSignedUrl(page, request, paperId);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(
    new RegExp(`/${organizationId}/library/device/${deviceId}/?$`),
    { timeout: 30_000 },
  );
  await page
    .getByText("Loading library...")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);

  let loadedSrc = "";
  await expect
    .poll(
      async () => {
        const images = await page.locator("img").evaluateAll((elements) =>
          elements.map((image) => ({
            alt: image.getAttribute("alt") || "",
            src: (image as HTMLImageElement).currentSrc,
            complete: (image as HTMLImageElement).complete,
            naturalWidth: (image as HTMLImageElement).naturalWidth,
          })),
        );
        const loadedImage = images.find(
          (image) =>
            image.src.startsWith("http") &&
            !image.alt.includes("Login Background") &&
            !image.alt.includes("Loading") &&
            image.complete &&
            image.naturalWidth > 0,
        );

        if (loadedImage) {
          loadedSrc = loadedImage.src;
        }

        return loadedSrc || signedUrl;
      },
      { timeout: 15_000, intervals: [1000, 2000, 5000] },
    )
    .not.toBe("");

  return loadedSrc || signedUrl;
}

async function expectRenderedPaperId(
  page: Page,
  request: APIRequestContext,
  organizationId: string,
  deviceId: string,
  kind: string,
) {
  let paperId = "";

  await expect
    .poll(
      async () => {
        const papers = await getOrganizationPapers(page, request, organizationId);
        const paper = papers.results.find(
          (entry) =>
            entry.deviceId === deviceId && entry.kind === kind && entry.imageUpdatedAt,
        );

        paperId = paper?.id || "";
        return paperId;
      },
      { timeout: 120_000, intervals: [1000, 2000, 5000] },
    )
    .not.toBe("");

  return paperId;
}

async function expectGeneratedSignedUrl(
  page: Page,
  request: APIRequestContext,
  paperId: string,
) {
  let signedUrl = "";
  const imageKinds = ["original.png", ".png"];

  await expect
    .poll(
      async () => {
        for (const imageKind of imageKinds) {
          const image = await apiJson<SignedImageResponse>(
            page,
            request,
            `/papers/image/${paperId}`,
            {
              method: "POST",
              data: { kind: imageKind },
            },
          );

          const candidateUrl = image.signedUrl || image.url || "";
          if (!candidateUrl.startsWith("http")) {
            continue;
          }

          const response = await request.get(candidateUrl);
          if (response.ok()) {
            signedUrl = candidateUrl;
            return signedUrl;
          }
        }

        return "";
      },
      { timeout: 120_000, intervals: [1000, 2000, 5000] },
    )
    .not.toBe("");

  expect(signedUrl).toMatch(/^https?:\/\//);

  return signedUrl;
}

async function attachSignedUrlImage(
  request: APIRequestContext,
  testInfo: TestInfo,
  source: string | null,
  name: string,
) {
  if (!source || !source.startsWith("http")) {
    throw new Error(`Expected a real signed image URL for ${name}`);
  }

  let response = await request.get(source);

  await expect
    .poll(
      async () => {
        response = await request.get(source);
        return response.status();
      },
      {
        message: `${name} signed image download from ${source}`,
        timeout: 90_000,
        intervals: [1000, 2000, 5000],
      },
    )
    .toBe(200);

  const path = testInfo.outputPath(name);

  await fs.writeFile(path, await response.body());
  await testInfo.attach(name, {
    path,
    contentType: response.headers()["content-type"]?.split(";")[0] || "image/png",
  });
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

async function configureXkcdOpenIntegration(
  page: Page,
  organizationId: string,
  deviceId: string,
  testInfo?: TestInfo,
) {
  await openIntegrationEditor(page, organizationId, deviceId, "plugin", {
    pluginConfigUrl: xkcdOpenIntegrationConfigUrl,
  });
  await expect(
    page.getByRole("heading", { name: "Integration Plugin" }).first(),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Setup" }).click();
  const setupDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Setup" }),
  });
  await expect(setupDialog.getByRole("textbox")).toHaveValue(
    xkcdOpenIntegrationConfigUrl,
  );
  await expect(
    setupDialog.getByText("Integration loaded successfully"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(setupDialog.getByText("Daily XKCD (1.0.0)")).toBeVisible();
  if (testInfo) {
    await captureMilestone(page, testInfo, "35-integration-xkcd-setup.png");
  }
  await setupDialog.getByRole("button", { name: "Continue" }).click();
  await expect(setupDialog).toBeHidden({ timeout: 30_000 });

  await page.getByRole("button", { name: "Settings" }).click();
  const settingsDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Settings" }),
  });
  await expect(settingsDialog.getByRole("combobox")).toHaveValue("latest");
  await expect(settingsDialog.getByRole("textbox")).toHaveValue("0");
  await settingsDialog.getByRole("textbox").fill("1");
  if (testInfo) {
    await captureMilestone(page, testInfo, "36-integration-xkcd-settings.png");
  }
  await settingsDialog.getByRole("button", { name: "Continue" }).click();
  await expect(settingsDialog).toBeHidden({ timeout: 30_000 });
}

test.describe("Paper integrations", () => {
  test.describe.configure({ mode: "serial" });

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
      await maybeDeleteOrganization(page, createdOrganizationId, request);
      createdOrganizationId = undefined;
    }
  });

  test("opens practical integration editors", async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    page.on("dialog", (dialog) => dialog.accept());
    createdOrganizationId = await createTemporaryOrganization(page);
    const device = await createTemporaryTestDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    for (const editor of editorSmokeCases) {
      await openIntegrationEditor(
        page,
        createdOrganizationId,
        createdDeviceId,
        editor.kind,
      );
      await expect(
        page.getByRole("heading", { name: editor.heading }).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole("button", { name: editor.control }).first(),
      ).toBeVisible({ timeout: 30_000 });
      await captureMilestone(page, testInfo, editor.screenshot);
    }
  });

  test("sends deterministic integrations and downloads their signed images", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !shouldRunLocalApiRenderE2E,
      "Local API render-send coverage is opt-in. Set PLAYWRIGHT_RUN_RENDER_E2E=1 to run it.",
    );
    test.setTimeout(240_000);
    const releaseIntegrationLock = await acquireIntegrationRenderLock();

    try {
      createdOrganizationId = await createTemporaryOrganization(page);
      const device = await createTemporaryTestDevice(
        page,
        request,
        createdOrganizationId,
      );
      createdDeviceId = device.id;

      for (const sendCase of sendCases) {
        await openIntegrationEditor(
          page,
          createdOrganizationId,
          createdDeviceId,
          sendCase.kind,
        );
        await expect(
          page.getByRole("heading", { name: sendCase.heading }).first(),
        ).toBeVisible({ timeout: 30_000 });

        await sendCase.configure?.(page);
        await sendIntegrationToFrame(page);

        const signedUrl = await expectDeviceOverviewImage(
          page,
          request,
          createdOrganizationId,
          createdDeviceId,
          sendCase.kind,
        );
        await attachSignedUrlImage(
          request,
          testInfo,
          signedUrl,
          sendCase.signedUrlArtifact,
        );
        await captureMilestone(page, testInfo, sendCase.screenshot);

        await expect
          .poll(
            async () => {
              const papers = await getOrganizationPapers(
                page,
                request,
                createdOrganizationId!,
              );
              return papers.results.some(
                (paper) =>
                  paper.deviceId === createdDeviceId &&
                  paper.kind === sendCase.kind,
              );
            },
            { timeout: 30_000 },
          )
          .toBeTruthy();
      }
    } finally {
      await releaseIntegrationLock();
    }
  });

  test("loads and configures an Open Integration plugin", async ({
    page,
    request,
  }, testInfo) => {
    const { configUrl } = await installOpenIntegrationRoutes(page);

    createdOrganizationId = await createTemporaryOrganization(page);
    const device = await createTemporaryTestDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    await openIntegrationEditor(
      page,
      createdOrganizationId,
      createdDeviceId,
      "plugin",
      { pluginConfigUrl: configUrl },
    );
    await expect(
      page.getByRole("heading", { name: "Integration Plugin" }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Setup" }).click();
    const setupDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Setup" }),
    });
    await expect(setupDialog.getByRole("textbox")).toHaveValue(configUrl);
    await expect(
      setupDialog.getByText("Integration loaded successfully"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(setupDialog.getByText("E2E Open Plugin (1.0.0)")).toBeVisible();
    await captureMilestone(page, testInfo, "33-integration-open-plugin-setup.png");
    await setupDialog.getByRole("button", { name: "Continue" }).click();
    await expect(setupDialog).toBeHidden({ timeout: 30_000 });

    await page.getByRole("button", { name: "Settings" }).click();
    const settingsDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Settings" }),
    });
    const headlineInput = settingsDialog.getByRole("textbox").first();

    await expect(headlineInput).toHaveValue(
      "Open Integration E2E",
    );
    await headlineInput.fill("Open Integration from Playwright");
    await expect(settingsDialog.getByRole("combobox")).toHaveValue("green");
    await expect(settingsDialog.getByText("showTimestamp")).toBeVisible();

    const settingsFrame = settingsDialog.frameLocator(
      'iframe[title="Integration Settings"]',
    );
    await expect(
      settingsFrame.getByRole("heading", { name: "Open Integration Settings" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      settingsFrame.getByText(`Initialized for ${testDeviceKind}`),
    ).toBeVisible({ timeout: 30_000 });
    await settingsFrame.getByRole("button", { name: "Apply iframe settings" }).click();
    await expect(headlineInput).toHaveValue(
      "Open Integration from iframe",
      { timeout: 30_000 },
    );
    await captureMilestone(
      page,
      testInfo,
      "34-integration-open-plugin-settings.png",
    );
  });

  test("loads the real XKCD Open Integration", async ({
    page,
    request,
  }, testInfo) => {
    createdOrganizationId = await createTemporaryOrganization(page);
    const device = await createTemporaryTestDevice(
      page,
      request,
      createdOrganizationId,
    );
    createdDeviceId = device.id;

    await configureXkcdOpenIntegration(
      page,
      createdOrganizationId,
      createdDeviceId,
      testInfo,
    );
  });

  test("sends the real XKCD Open Integration", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      process.env.PLAYWRIGHT_USE_LOCAL_API !== "1",
      "The production API renderer needs the plugin message-order fix before this can pass there.",
    );
    test.skip(
      !shouldRunLocalApiRenderE2E,
      "Local API render-send coverage is opt-in. Set PLAYWRIGHT_RUN_RENDER_E2E=1 to run it.",
    );
    test.setTimeout(120_000);
    const releaseIntegrationLock = await acquireIntegrationRenderLock();

    try {
      createdOrganizationId = await createTemporaryOrganization(page);
      const device = await createTemporaryTestDevice(
        page,
        request,
        createdOrganizationId,
      );
      createdDeviceId = device.id;

      await configureXkcdOpenIntegration(
        page,
        createdOrganizationId,
        createdDeviceId,
      );

      await sendIntegrationToFrame(page);

      const signedUrl = await expectDeviceOverviewImage(
        page,
        request,
        createdOrganizationId,
        createdDeviceId,
        "plugin",
      );
      await attachSignedUrlImage(
        request,
        testInfo,
        signedUrl,
        "37-integration-xkcd-signed-url.png",
      );
      await captureMilestone(page, testInfo, "37-integration-xkcd-sent.png");

      await expect
        .poll(async () => {
          const papers = await getOrganizationPapers(
            page,
            request,
            createdOrganizationId!,
          );
          return papers.results.some(
            (paper) =>
              paper.deviceId === createdDeviceId && paper.kind === "plugin",
          );
        })
        .toBeTruthy();
    } finally {
      await releaseIntegrationLock();
    }
  });
});
