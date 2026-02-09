import httpStatus from "http-status";
import type { Request, Response } from "express";
import catchAsync from "@internetderdinge/api/src/utils/catchAsync";
import renderService from "./render.service.js";

const generateImageFromUrl = catchAsync(async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];

  const token = authHeader.split(" ")[1];

  const result = await renderService.generateImageFromUrl({
    ...req.query,
    token,
  });

  res.status(httpStatus.CREATED).send({ signed: result });
});

export default {
  generateImageFromUrl,
};
