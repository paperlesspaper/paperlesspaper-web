import { ApiError, catchAsync, devicesService } from "@internetderdinge/api";
import renderService from "../render/render.service.js";
import httpStatus from "http-status";
import service from "./devices.service.js";

import type { Request, Response } from "express";

const uploadSingleImageFromWebsite = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const device = await devicesService.getById(req.params.deviceId);
    if (!device) {
      throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
    }

    const { buffer } = await renderService.generateImageFromUrl({
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
    });

    res.send(iotUpload);
  },
);

export default {
  getImageById,
  updateSingleImageMeta,
  uploadSingleImage,
  uploadSingleImageFromWebsite,
};
