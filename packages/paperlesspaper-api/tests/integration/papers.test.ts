import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupIntegrationTest } from "./testUtils";

const baseUrl = "/v1/papers";
const { getApp, getApiKey, getSeedData, recordResponse } =
  setupIntegrationTest("papers");

describe("Papers API", () => {
  it("lists papers by organization and fetches a paper", async () => {
    const testName = "lists papers by organization and fetches a paper";
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const listRes = await request(app)
      .get(baseUrl)
      .query({ organization: seed!.organizationId })
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "list", listRes);
    expect(Array.isArray(listRes.body.results)).toBe(true);

    const listed = listRes.body.results.find(
      (entry: { id?: string; _id?: string }) =>
        (entry.id || entry._id) === seed!.paperId,
    );
    expect(listed).toBeTruthy();

    const getRes = await request(app)
      .get(`${baseUrl}/${seed!.paperId}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "get", getRes);
    expect(getRes.body.id || getRes.body._id).toBe(seed!.paperId);
  });
});
