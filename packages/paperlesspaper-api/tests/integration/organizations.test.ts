import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupIntegrationTest } from "./testUtils";

const baseUrl = "/v1/organizations";
const { getApp, getApiKey, recordResponse } =
  setupIntegrationTest("organizations");

describe("Organizations API", () => {
  it("creates, reads, updates, and deletes an organization", async () => {
    const testName = "creates, reads, updates, and deletes an organization";
    const app = getApp();
    const apiKey = getApiKey();
    const createRes = await request(app)
      .post(baseUrl)
      .set("x-api-key", apiKey)
      .send({ kind: "private" })
      .expect(201);
    recordResponse(testName, "create", createRes);

    const orgId = createRes.body.id || createRes.body._id;
    expect(orgId).toBeTruthy();

    const listRes = await request(app)
      .get(baseUrl)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "list", listRes);

    expect(Array.isArray(listRes.body.results)).toBe(true);
    const listed = listRes.body.results.find(
      (entry: { id?: string; _id?: string }) =>
        (entry.id || entry._id) === orgId,
    );
    expect(listed).toBeTruthy();

    const getRes = await request(app)
      .get(`${baseUrl}/${orgId}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "get", getRes);
    expect(getRes.body.id || getRes.body._id).toBe(orgId);

    const updateRes = await request(app)
      .patch(`${baseUrl}/${orgId}`)
      .set("x-api-key", apiKey)
      .send({
        name: "Updated Org",
        kind: "private-wirewire",
        organization: orgId,
      })
      .expect(200);
    recordResponse(testName, "update", updateRes);
    expect(updateRes.body.name).toBe("Updated Org");

    const deleteRes = await request(app)
      .delete(`${baseUrl}/${orgId}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "delete", deleteRes);
    expect(deleteRes.body.id || deleteRes.body._id).toBe(orgId);

    await request(app)
      .get(`${baseUrl}/${orgId}`)
      .set("x-api-key", apiKey)
      .expect(404);
  });
});
