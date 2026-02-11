import {
  ApiError,
  catchAsync,
  devicesService,
  iotDevicesService,
} from "@internetderdinge/api";
import renderService from "../render/render.service";
import httpStatus from "http-status";

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

    const iotUpload = await iotDevicesService.uploadSingleImage({
      deviceName: device.deviceId,
      buffer: buffer as Buffer,
      deviceId: req.params.deviceId,
      uuid: req.body.uuid,
    });

    const { uuid, ...body } = req.body;
    const deviceUpdate = await devicesService.updateById(req.params.deviceId, {
      meta: { ...device.meta, file: uuid },
    });
    const deviceMeta = await devicesService.updateSingleImageMeta(
      device.deviceId,
      body,
    );

    res.send({ deviceMeta, deviceUpdate, iotUpload });
  },
);

export default {
  uploadSingleImageFromWebsite,
};
