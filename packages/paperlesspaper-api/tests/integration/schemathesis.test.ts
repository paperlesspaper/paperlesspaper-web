import { describe, it } from "vitest";
import { setupSchemathesisTest } from "./testUtils";

const { getBaseUrl, runSchemathesis } =
  setupSchemathesisTest("paperlesspaper-api");

const resolveSchemaUrl = (): string => {
  if (process.env.SCHEMATHESIS_SCHEMA_URL) {
    return process.env.SCHEMATHESIS_SCHEMA_URL;
  }
  const baseUrl = getBaseUrl();
  const origin = baseUrl.replace(/\/v1$/, "");
  return `${origin}/openapi.json`;
};

describe("Schemathesis OpenAPI validation", () => {
  it("validates all endpoints against the OpenAPI schema", async () => {
    await runSchemathesis(resolveSchemaUrl());
  }, 300000);
});
