import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  specs: [] as any[],
  originals: [] as any[],
  registerDevice: vi.fn(),
  getRegistrationStatus: vi.fn(),
  updateEntry: vi.fn(),
}));
vi.mock("../../src/devices/deviceRegistration.service.js", () => ({
  registerDevice: state.registerDevice,
  getRegistrationStatus: state.getRegistrationStatus,
}));
vi.mock("../../src/devices/devices.controller", () => ({ default: { updateEntry: state.updateEntry } }));
vi.mock("../../src/devices/devices.validation.js", () => ({
  deleteDeviceByDeviceIdSchema: {},
  getDeviceUploadLogsSchema: {},
  getImageSchema: {},
  updateSingleImageMetaSchema: {},
  uploadSingleImageSchema: {},
}));
vi.mock("@internetderdinge/api", async () => {
  const { Router } = await import("express");
  return {
    ApiError: class extends Error {},
    auth: () => vi.fn(),
    validateAdmin: vi.fn(),
    validateDevice: vi.fn(),
    uploadSingleImageFromWebsiteSchema: {},
    buildRouterAndDocs: vi.fn(),
    catchAsync: (handler: any) => handler,
    createDevicesRoute: ({ routeSpecs }: any) => {
      state.originals = [
        { method: "get", path: "/registration-status/:deviceId" },
        { method: "post", path: "/registerdevice/:deviceId" },
        { method: "patch", path: "/:deviceId" },
        { method: "post", path: "/:deviceId" },
        { method: "get", path: "/:deviceId" },
      ].map((spec) => ({
        ...spec,
        validate: [vi.fn(), vi.fn(), vi.fn()],
        requestSchema: {},
        handler: vi.fn(),
      }));
      state.specs = routeSpecs(state.originals);
      return Router();
    },
  };
});

import "../../src/devices/devices.route";
beforeEach(() => vi.clearAllMocks());

it("retains the existing authorization and request validation for device routes", () => {
  state.specs.forEach((spec, index) => {
    expect(spec.validate).toBe(state.originals[index].validate);
    expect(spec.requestSchema).toBe(state.originals[index].requestSchema);
  });
});

it("applies saved schedules through both update endpoints without replacing reads", () => {
  expect(state.specs[2].handler).toBe(state.updateEntry);
  expect(state.specs[3].handler).toBe(state.updateEntry);
  expect(state.specs[4].handler).toBe(state.originals[4].handler);
});

it("uses normalized serials and the authorized target organization", async () => {
  const result = { activation_status: "pending", registrationCompleted: false };
  state.registerDevice.mockResolvedValue(result);
  const body = { organization: "org-b", enable: true };
  const res = { send: vi.fn() };
  await state.specs[1].handler(
    { params: { deviceId: " epd7-test " }, body },
    res,
    vi.fn()
  );
  expect(state.registerDevice).toHaveBeenCalledExactlyOnceWith(
    "epd7-test",
    body
  );
  expect(res.send).toHaveBeenCalledWith(result);
  expect(state.originals[1].handler).not.toHaveBeenCalled();
});

it("routes the preflight through the read-only ownership check", async () => {
  const res = { send: vi.fn() };
  await state.specs[0].handler(
    { params: { deviceId: "epd7-test" }, query: { organization: "org-b" } },
    res,
    vi.fn()
  );
  expect(state.getRegistrationStatus).toHaveBeenCalledExactlyOnceWith(
    "epd7-test",
    "org-b"
  );
  expect(state.registerDevice).not.toHaveBeenCalled();
});

it("preserves the shared handlers for other device families", async () => {
  const req = { params: { deviceId: "other-test" }, body: {} };
  const res = { send: vi.fn() };
  const next = vi.fn();
  await state.specs[1].handler(req, res, next);
  expect(state.originals[1].handler).toHaveBeenCalledExactlyOnceWith(
    req,
    res,
    next
  );
  expect(state.registerDevice).not.toHaveBeenCalled();
});
