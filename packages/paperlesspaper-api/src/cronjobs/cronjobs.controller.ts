import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "@internetderdinge/api";
import { enqueueNow } from "./bullmq.service";
import messagesService from "../messages/messages.service";

const battery = catchAsync(async (req: Request, res: Response) => {
  const result = await enqueueNow("batteryCronjob", req.body);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const messages = await messagesService.findMessage({ _id: result.id });

  res
    .status(httpStatus.CREATED)
    .send({ search: { id: result.id }, result, messages });
});

const papersCronjob = catchAsync(async (req: Request, res: Response) => {
  console.log("Received request to start papersCronjob");
  const result = await enqueueNow("papersCronjob", req.body);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // const messages = await messagesService.findMessage({ _id: result.attrs._id });

  res.status(httpStatus.CREATED).send({ search: { id: result.id }, result });
});

export default {
  battery,
  papersCronjob,
};
