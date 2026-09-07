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

  it("requires a dry run before admins deactivate a device", async () => {
    const testName = "requires a dry run before admins deactivate a device";
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const { devicesService } = await import("@internetderdinge/api");
    const papersService = (await import("../../src/papers/papers.service"))
      .default;
    const Paper = (await import("../../src/papers/papers.model")).default;
    const serial = `epd-delete-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    const device = await devicesService.createDevice({
      organization: seed!.organizationId,
      deviceId: serial,
      kind: "epaper-13",
      meta: { sleepTime: "3600", orientation: "portrait" },
    });

    const firstPaper = await papersService.createPaper({
      deviceId: device._id,
      kind: "calendar",
      organization: seed!.organizationId,
      name: "First paper to detach",
      meta: {},
    });
    const secondPaper = await papersService.createPaper({
      deviceId: device._id,
      kind: "website",
      organization: seed!.organizationId,
      name: "Second paper to detach",
      meta: {},
    });
    const survivingPaper = await papersService.createPaper({
      deviceId: seed!.deviceObjectId,
      kind: "playlist",
      organization: seed!.organizationId,
      name: "Surviving playlist",
      meta: {
        selectedPapers: {
          [firstPaper._id.toString()]: true,
          [secondPaper._id.toString()]: true,
          [seed!.paperId]: true,
        },
        playlistEntries: [
          { paperId: firstPaper._id.toString() },
          { paperId: secondPaper._id.toString() },
          { paperId: seed!.paperId },
        ],
      },
    });

    const dryRunRes = await request(app)
      .delete(`${baseUrl}/by-device-id/${serial}`)
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "dry-run", dryRunRes);

    expect(dryRunRes.body).toMatchObject({
      dryRun: true,
      deactivated: false,
      preview: {
        device: {
          id: device._id.toString(),
          deviceId: serial,
        },
        papersToDetach: { count: 2 },
        iotDeviceWillBeDeactivated: true,
      },
    });
    expect(dryRunRes.body.preview.confirmationToken).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      devicesService.getById(device._id.toString()),
    ).resolves.toBeTruthy();
    await expect(Paper.countDocuments({ deviceId: device._id })).resolves.toBe(
      2,
    );

    await request(app)
      .delete(`${baseUrl}/by-device-id/${serial}`)
      .query({ dryRun: "false" })
      .set("x-api-key", apiKey)
      .expect(409);

    const deleteRes = await request(app)
      .delete(`${baseUrl}/by-device-id/${serial}`)
      .query({
        dryRun: "false",
        confirmationToken: dryRunRes.body.preview.confirmationToken,
      })
      .set("x-api-key", apiKey)
      .expect(200);
    recordResponse(testName, "deactivate", deleteRes);

    expect(deleteRes.body).toMatchObject({
      dryRun: false,
      deactivated: true,
      iotDeviceDeactivated: true,
      deleted: {
        devices: 1,
      },
      updated: {
        papers: 2,
      },
    });
    await expect(
      devicesService.getById(device._id.toString()),
    ).resolves.toBeNull();
    await expect(Paper.countDocuments({ deviceId: device._id })).resolves.toBe(
      0,
    );
    await expect(
      Paper.countDocuments({
        _id: { $in: [firstPaper._id, secondPaper._id] },
        deviceId: { $exists: false },
      }),
    ).resolves.toBe(2);

    const storedSurvivingPaper = await Paper.findById(survivingPaper._id);
    expect(storedSurvivingPaper).toBeTruthy();
    expect(
      storedSurvivingPaper!.meta.selectedPapers[firstPaper._id.toString()],
    ).toBe(true);
    expect(
      storedSurvivingPaper!.meta.selectedPapers[secondPaper._id.toString()],
    ).toBe(true);
    expect(storedSurvivingPaper!.meta.selectedPapers[seed!.paperId]).toBe(true);
    expect(storedSurvivingPaper!.meta.playlistEntries).toEqual([
      { paperId: firstPaper._id.toString() },
      { paperId: secondPaper._id.toString() },
      { paperId: seed!.paperId },
    ]);
  });

  it("rejects a stale dry-run confirmation token", async () => {
    const app = getApp();
    const apiKey = getApiKey();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const { devicesService } = await import("@internetderdinge/api");
    const papersService = (await import("../../src/papers/papers.service"))
      .default;
    const Paper = (await import("../../src/papers/papers.model")).default;
    const serial = `epd-stale-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    const device = await devicesService.createDevice({
      organization: seed!.organizationId,
      deviceId: serial,
      kind: "epaper-13",
      meta: {},
    });
    await papersService.createPaper({
      deviceId: device._id,
      kind: "calendar",
      organization: seed!.organizationId,
      name: "Paper in original preview",
      meta: {},
    });

    const dryRunRes = await request(app)
      .delete(`${baseUrl}/by-device-id/${serial}`)
      .set("x-api-key", apiKey)
      .expect(200);

    await papersService.createPaper({
      deviceId: device._id,
      kind: "website",
      organization: seed!.organizationId,
      name: "Paper added after preview",
      meta: {},
    });

    const staleRes = await request(app)
      .delete(`${baseUrl}/by-device-id/${serial}`)
      .query({
        dryRun: "false",
        confirmationToken: dryRunRes.body.preview.confirmationToken,
      })
      .set("x-api-key", apiKey)
      .expect(409);

    expect(staleRes.body.message).toMatch(/dry run is missing or stale/i);
    await expect(
      devicesService.getById(device._id.toString()),
    ).resolves.toBeTruthy();
    await expect(Paper.countDocuments({ deviceId: device._id })).resolves.toBe(
      2,
    );
  });

  it("rejects non-admin device deactivation dry runs", async () => {
    const app = getApp();
    const seed = getSeedData();
    expect(seed).toBeTruthy();

    const { devicesService } = await import("@internetderdinge/api");
    const serial = `epd-non-admin-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    await devicesService.createDevice({
      organization: seed!.organizationId,
      deviceId: serial,
      kind: "epaper-13",
      meta: {},
    });

    const previousApiKeyAdmin = process.env.API_KEY_ADMIN;
    process.env.API_KEY_ADMIN = "false";
    try {
      const { createToken } = await import("@internetderdinge/api");
      const token = await createToken({
        name: "non-admin-delete-device",
        owner: `non-admin-delete-device-${Date.now()}`,
      });

      await request(app)
        .delete(`${baseUrl}/by-device-id/${serial}`)
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
