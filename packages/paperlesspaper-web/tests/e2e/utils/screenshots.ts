import type { Page, TestInfo } from "@playwright/test";

export async function captureMilestone(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const path = testInfo.outputPath(name);

  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, {
    path,
    contentType: "image/png",
  });
}
