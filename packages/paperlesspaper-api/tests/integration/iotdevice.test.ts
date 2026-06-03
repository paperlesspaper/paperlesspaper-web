import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupIntegrationTest } from "./testUtils";

const baseUrl = "/v1/iotdevice";
const { getApp, getApiKey, getSeedData, recordResponse } =
  setupIntegrationTest("iotdevice");

describe("IoT Device API", () => {
  it("returns device events for a given deviceId", async () => {
    const testName = "returns device events for a given deviceId";
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const res = await request(app)
      .get(`${baseUrl}/events/${seed!.deviceId}`)
      .query({
        DateStart: "2025-05-01T00:00:00Z",
        DateEnd: "2025-05-31T23:59:59Z",
        TypeFilter: "",
      })
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "events", res);
    expect(res.body).toBeDefined();
  });

  it("returns device shadow for a given deviceId and shadowName", async () => {
    const testName = "returns device shadow for a given deviceId and shadowName";
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const res = await request(app)
      .get(`${baseUrl}/shadow/${seed!.deviceId}/settings`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "shadow", res);
    expect(res.body).toBeDefined();
  });

  it("updates device shadow alarm for a given deviceId", async () => {
    const testName = "updates device shadow alarm for a given deviceId";
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const res = await request(app)
      .post(`${baseUrl}/device/shadowAlarmUpdate/${seed!.deviceId}`)
      .set("x-api-key", apiKey)
      .send({ state: { reported: { alarm: false } } })
      .expect(200);
    recordResponse(testName, "shadowAlarmUpdate", res);
    expect(res.body).toBeDefined();
  });
});
