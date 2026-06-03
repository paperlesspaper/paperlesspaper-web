import { catchAsync, iotDevicesService } from "@internetderdinge/api";

import type { Request, Response } from "express";

const getEvents = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const result = await iotDevicesService.getEvents(
      req.params.deviceId,
      req.query,
    );
    res.send(result);
  },
);

const getShadow = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const result = await iotDevicesService.shadowAlarmGet(
      req.params.deviceId,
      req.params.shadowName,
    );
    res.send(result);
  },
);

const shadowAlarmUpdate = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const result = await iotDevicesService.shadowAlarmUpdate(
      req.params.deviceId,
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
