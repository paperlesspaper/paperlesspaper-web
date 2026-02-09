import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupIntegrationTest } from "./testUtils";

const baseUrl = "/v1/tokens";

const { getApp, getApiKey, recordResponse } = setupIntegrationTest("tokens");

describe("Tokens API", () => {
  it("creates, lists, gets, and deletes a token", async () => {
    const testName = "creates, lists, gets, and deletes a token";
    const app = getApp();
    const apiKey = getApiKey();

    const createRes = await request(app)
      .post(baseUrl)
      .set("x-api-key", apiKey)
      .send({ name: "test-token" })
      .expect(201);
    recordResponse(testName, "create", createRes);

    const tokenId = createRes.body.id || createRes.body._id;
    expect(tokenId).toBeTruthy();

    const listRes = await request(app)
      .get(baseUrl)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "list", listRes);
    expect(Array.isArray(listRes.body.results)).toBe(true);

    const getRes = await request(app)
      .get(`${baseUrl}/${tokenId}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "get", getRes);
    expect(getRes.body.id || getRes.body._id).toBe(tokenId);

    const deleteRes = await request(app)
      .delete(`${baseUrl}/${tokenId}`)
      .set("x-api-key", apiKey)
      .expect(204);
    recordResponse(testName, "delete", deleteRes);
  });
});
