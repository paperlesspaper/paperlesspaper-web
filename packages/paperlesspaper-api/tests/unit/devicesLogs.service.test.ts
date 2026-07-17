import { afterEach, describe, expect, it, vi } from "vitest";
import DevicesLogs from "../../src/devicesLogs/devicesLogs.model";
import {
  getDeviceUploadLogs,
  sanitizeDeviceLogValue,
  serializeDeviceLogError,
} from "../../src/devicesLogs/devicesLogs.service";

describe("devicesLogs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the exact devicesLogs collection and device/time indexes", () => {
    expect(DevicesLogs.collection.collectionName).toBe("devicesLogs");
    expect(DevicesLogs.schema.path("pipeline")?.instance).toBe("Mixed");
    expect(DevicesLogs.schema.path("render")?.instance).toBe("Mixed");

    const indexes = DevicesLogs.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ attemptId: 1 }, expect.objectContaining({ unique: true })],
        [{ deviceName: 1, startedAt: -1 }, expect.any(Object)],
      ]),
    );
  });

  it("redacts credentials, upload URLs, and binary data", () => {
    const sanitized = sanitizeDeviceLogValue({
      accessToken: "secret-token",
      uploadURL: "https://signed.example/private",
      nested: {
        authorization: "Bearer secret",
        responseKey: "safe-value",
      },
      image: Buffer.from("image-data"),
    });

    expect(sanitized).toEqual({
      accessToken: "[redacted]",
      uploadURL: "[redacted]",
      nested: {
        authorization: "[redacted]",
        responseKey: "safe-value",
      },
      image: "[buffer:10 bytes]",
    });
  });

  it("serializes useful error diagnostics", () => {
    const error = Object.assign(new Error("upload failed"), {
      code: "UPLOAD_FAILED",
      response: { status: 503 },
    });

    expect(serializeDeviceLogError(error)).toEqual(
      expect.objectContaining({
        name: "Error",
        message: "upload failed",
        code: "UPLOAD_FAILED",
        httpStatus: 503,
        stack: expect.any(String),
      }),
    );
  });

  it("loads the latest attempts by database id or physical device name", async () => {
    const exec = vi.fn().mockResolvedValue([{ attemptId: "attempt-1" }]);
    const limit = vi.fn().mockReturnValue({ lean: () => ({ exec }) });
    const sort = vi.fn().mockReturnValue({ limit });
    const find = vi.spyOn(DevicesLogs, "find").mockReturnValue({ sort } as any);

    await expect(
      getDeviceUploadLogs({
        deviceId: "device-object-id",
        deviceName: "epd-device-name",
        limit: 500,
      }),
    ).resolves.toEqual([{ attemptId: "attempt-1" }]);

    expect(find).toHaveBeenCalledWith({
      $or: [
        { deviceId: "device-object-id" },
        { deviceName: "epd-device-name" },
      ],
    });
    expect(sort).toHaveBeenCalledWith({ startedAt: -1 });
    expect(limit).toHaveBeenCalledWith(100);
  });
});
