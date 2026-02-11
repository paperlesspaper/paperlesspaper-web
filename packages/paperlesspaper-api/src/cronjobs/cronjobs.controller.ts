import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "@internetderdinge/api";
import agenda from "./agenda.service.js";
import messagesService from "../messages/messages.service";

const battery = catchAsync(async (req: Request, res: Response) => {
  const result = await agenda.now("batteryCronjob", req.body);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const messages = await messagesService.findMessage({ _id: result.attrs._id });

  res
    .status(httpStatus.CREATED)
    .send({ search: { id: result.attrs._id }, result, messages });
});

const papersCronjob = catchAsync(async (req: Request, res: Response) => {
  console.log("Received request to start papersCronjob");
  const result = await agenda.now("papersCronjob", req.body);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // const messages = await messagesService.findMessage({ _id: result.attrs._id });

  res
    .status(httpStatus.CREATED)
    .send({ search: { id: result.attrs._id }, result });
});

export default {
  battery,
  papersCronjob,
};
