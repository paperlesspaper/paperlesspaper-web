import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupIntegrationTest } from "./testUtils";

const baseUrl = "/v1/devices";
const { getApp, getApiKey, getSeedData, recordResponse } =
  setupIntegrationTest("devices");

describe("Devices API", () => {
  it("lists devices by organization and fetches a device", async () => {
    const testName = "lists devices by organization and fetches a device";
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
        (entry.id || entry._id) === seed!.deviceObjectId,
    );
    expect(listed).toBeTruthy();

    const getRes = await request(app)
      .get(`${baseUrl}/${seed!.deviceObjectId}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "get", getRes);
    expect(getRes.body.id || getRes.body._id).toBe(seed!.deviceObjectId);
  });

  it("lets admins delete a device by DeviceId", async () => {
    const testName = "lets admins delete a device by DeviceId";
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const { devicesService } = await import("@internetderdinge/api");
    const serial = `epd-delete-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const device = await devicesService.createDevice({
      organization: seed!.organizationId,
      deviceId: serial,
      kind: "epaper-13",
      meta: { sleepTime: "3600", orientation: "portrait" },
    });

    const deleteRes = await request(app)
      .delete(`${baseUrl}/by-device-id/${serial}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "delete", deleteRes);

    expect(deleteRes.body.deviceId).toBe(serial);
    await expect(
      devicesService.getById(device._id.toString()),
    ).resolves.toBeNull();
  });

  it("rejects non-admin deletes by DeviceId", async () => {
    const app = getApp();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const previousApiKeyAdmin = process.env.API_KEY_ADMIN;
    process.env.API_KEY_ADMIN = "false";
    try {
      const { createToken } = await import("@internetderdinge/api");
      const token = await createToken({
        name: "non-admin-delete-device",
        owner: `non-admin-delete-device-${Date.now()}`,
      });

      await request(app)
        .delete(`${baseUrl}/by-device-id/${seed!.deviceId}`)
        .set("x-api-key", token.raw)
        .expect(403);
    } finally {
      if (previousApiKeyAdmin === undefined) {
        delete process.env.API_KEY_ADMIN;
      } else {
        process.env.API_KEY_ADMIN = previousApiKeyAdmin;
      }
    }
  });
});
