import { expect, type APIRequestContext, type Page } from "@playwright/test";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const apiBaseURL = process.env.REACT_APP_SERVER_BASE_URL?.replace(/\/$/, "");

function resolveApiURL(path: string): string {
  if (!apiBaseURL) {
    throw new Error("REACT_APP_SERVER_BASE_URL is required for e2e API calls.");
  }

  return `${apiBaseURL}/${path.replace(/^\//, "")}`;
}

export async function getAccessToken(page: Page): Promise<string> {
  await page.waitForFunction(() => {
    return Object.values(window.localStorage).some((value) => {
      try {
        const parsed = JSON.parse(value);
        return Boolean(parsed?.body?.access_token || parsed?.access_token);
      } catch {
        return false;
      }
    });
  });

  const accessToken = await page.evaluate(() => {
    const extract = (value: string) => {
      try {
        const parsed = JSON.parse(value);
        return parsed?.body?.access_token || parsed?.access_token;
      } catch {
        return undefined;
      }
    };

    for (const value of Object.values(window.localStorage)) {
      const token = extract(value);
      if (token) return token;
    }

    return undefined;
  });

  expect(accessToken, "Auth0 access token should be present").toBeTruthy();

  return accessToken!;
}

export async function apiJson<T>(
  page: Page,
  request: APIRequestContext,
  path: string,
  options: {
    method?: HttpMethod;
    data?: Record<string, unknown>;
    expectedStatus?: number | number[];
  } = {},
): Promise<T> {
  const token = await getAccessToken(page);
  const expectedStatuses = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : [options.expectedStatus ?? 200];
  const response = await request.fetch(resolveApiURL(path), {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
    data: options.data,
  });

  expect(
    expectedStatuses,
    `${options.method ?? "GET"} ${path} should return ${expectedStatuses.join(
      " or ",
    )}`,
  ).toContain(response.status());

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function apiKeyJson<T>(
  request: APIRequestContext,
  path: string,
  apiKey: string,
  options: {
    method?: HttpMethod;
    data?: Record<string, unknown>;
    expectedStatus?: number | number[];
  } = {},
): Promise<T> {
  const expectedStatuses = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : [options.expectedStatus ?? 200];
  const response = await request.fetch(resolveApiURL(path), {
    method: options.method ?? "GET",
    headers: {
      "x-api-key": apiKey,
    },
    data: options.data,
  });

  expect(
    expectedStatuses,
    `${options.method ?? "GET"} ${path} with API key should return ${expectedStatuses.join(
      " or ",
    )}`,
  ).toContain(response.status());

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
