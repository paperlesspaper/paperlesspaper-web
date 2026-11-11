import {
  ApiError,
  catchAsync,
  devicesService,
  iotDevicesService,
  isAdmin,
} from "@internetderdinge/api";
import { getDeviceUpdateScheduleDecision } from "../cronjobs/deviceUpdateSchedule.cronjob.js";
import renderService from "../render/render.service.js";
import devicesLogsService from "../devicesLogs/devicesLogs.service.js";
import httpStatus from "http-status";
import service from "./devices.service.js";

import type { Request, Response } from "express";

// Keep the shared device-update behavior, then apply the saved schedule before
// responding. Both PATCH and the legacy POST endpoint use this handler.
const updateEntry = catchAsync(async (req: Request, res: Response) => {
  const { updatedAt, createdAt, payment, iotDevice, ...newBody } = req.body;
  const body: Record<string, any> = {
    ...newBody,
    shadow: typeof req.body?.shadow === "object" ? req.body.shadow : undefined,
  };
  if (isAdmin(res.req.auth) && payment) body.payment = payment;

  let device = await devicesService.updateById(req.params.deviceId, body);
  if (isAdmin(res.req.auth) && iotDevice && device.deviceId) {
    await iotDevicesService.updateDevice(device.deviceId, iotDevice);
  }

  if (
    req.body.meta?.updateSchedule !== undefined &&
    device.meta?.updateSchedule?.enabled === true &&
    device.deviceId &&
    ["epaper", "epd7", "openpaper13", "epaper-13"].includes(device.kind)
  ) {
    const now = new Date();
    // Settings can be consumed immediately by a manual wake after saving.
    // Calculate from now, without waiting for the cron's predicted-wakeup window.
    const decision = getDeviceUpdateScheduleDecision({
      device,
      deviceStatus: { nextDeviceSync: now.getTime() },
      now,
    });
    if (decision.action !== "skip") {
      const result = await iotDevicesService.shadowAlarmUpdate(
        device.deviceId,
        { state: { reported: { sleepTime: decision.sleepTime } } },
        "settings",
      );
      if (result === "error") {
        throw new ApiError(
          httpStatus.BAD_GATEWAY,
          "Could not apply device update schedule",
        );
      }
      // Return the actual settings, not the normal interval sent by updateById.
      device = await devicesService.getByIdWithIoT(req.params.deviceId);
    }
  }

  res.send(device);
});

const uploadSingleImageFromWebsite = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const device = await devicesService.getById(req.params.deviceId);
    if (!device) {
      throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
    }

    const { buffer, diagnostics } = await renderService.generateImageFromUrl({
      url: device.meta?.url,
      orientation: device.meta?.orientation,
      scroll: device.meta?.scroll,
      kind: device.kind,
    });

    if (!buffer) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Failed to render image");
    }

    const iotUpload = await service.uploadSingleImage({
      deviceName: device.deviceId,
      buffer: buffer as Buffer,
      deviceId: req.params.deviceId,
      uuid: req.body.uuid,
      trigger: "devices-api-website-render",
      render: diagnostics,
    });

    const { uuid, ...body } = req.body;
    const deviceUpdate = await devicesService.updateById(req.params.deviceId, {
      meta: { ...device.meta, file: uuid },
    });
    const deviceMeta = await service.updateSingleImageMeta(
      device.deviceId,
      body,
    );

    res.send({ deviceMeta, deviceUpdate, iotUpload });
  },
);

const getImageById = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const image = await service.getImageById(
      req.params.deviceId,
      req.params.uuid,
    );
    res.send(image);
  },
);

const getUploadLogs = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const device = await devicesService.getById(req.params.deviceId);
    if (!device) {
      throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
    }

    const results = await devicesLogsService.getDeviceUploadLogs({
      deviceId: req.params.deviceId,
      deviceName: device.deviceId,
      limit: Number(req.query.limit) || 50,
    });

    res.send({ results });
  },
);

const updateSingleImageMeta = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const device = await devicesService.getById(req.params.deviceId);
    if (!device) {
      throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
    }

    const { uuid, ...body } = req.body;
    const deviceUpdate = await devicesService.updateById(req.params.deviceId, {
      meta: { ...device.meta, file: uuid },
    });
    const deviceMeta = await service.updateSingleImageMeta(
      device.deviceId,
      body,
    );
    res.send({ deviceMeta, deviceUpdate });
  },
);

const uploadSingleImage = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const device = await devicesService.getById(req.params.deviceId);
    if (!device) {
      throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
    }

    const files = req.files as Array<{ buffer: Buffer }> | undefined;
    if (!files || files.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No image file uploaded");
    }

    const iotUpload = await service.uploadSingleImage({
      deviceName: device.deviceId,
      buffer: files[0].buffer,
      deviceId: req.params.deviceId,
      uuid: req.body.uuid,
      trigger: "devices-api-manual-upload",
    });

    res.send(iotUpload);
  },
);

const deleteByDeviceId = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const previousDeviceObjectId =
      typeof req.query.previousDeviceObjectId === "string"
        ? req.query.previousDeviceObjectId
        : undefined;
    if (req.query.dryRun !== "false") {
      const preview = await service.getDeviceDeactivationPreview(
        req.params.deviceId,
        undefined,
        previousDeviceObjectId,
      );
      res.send({
        dryRun: true,
        deactivated: false,
        preview,
      });
      return;
    }

    const result = await service.deactivateDeviceByDeviceId({
      previousDeviceObjectId,
      deviceId: req.params.deviceId,
      confirmationToken:
        typeof req.query.confirmationToken === "string"
          ? req.query.confirmationToken
          : undefined,
    });
    res.send({
      dryRun: false,
      deactivated: true,
      ...result,
    });
  },
);

export default {
  updateEntry,
  deleteByDeviceId,
  getImageById,
  getUploadLogs,
  updateSingleImageMeta,
  uploadSingleImage,
  uploadSingleImageFromWebsite,
};
