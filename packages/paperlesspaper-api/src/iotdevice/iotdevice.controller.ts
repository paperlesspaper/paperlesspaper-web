import { ApiError, catchAsync, iotDevicesService } from "@internetderdinge/api";
import httpStatus from "http-status";

import type { Request, Response } from "express";

const getEvents = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { deviceId } = req.params;
    if (!deviceId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "deviceId is required");
    }

    const result = await iotDevicesService.getEvents(deviceId, req.query);
    res.send(result);
  },
);

const getShadow = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { deviceId, shadowName } = req.params;
    if (!deviceId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "deviceId is required");
    }

    const result = await iotDevicesService.shadowAlarmGet(deviceId, shadowName);
    res.send(result);
  },
);

const shadowAlarmUpdate = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { deviceId } = req.params;
    if (!deviceId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "deviceId is required");
    }

    const result = await iotDevicesService.shadowAlarmUpdate(
      deviceId,
      req.body,
    );
    res.send(result);
  },
);

export default {
  getEvents,
  getShadow,
  shadowAlarmUpdate,
};
