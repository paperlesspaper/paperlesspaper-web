import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import {
  ApiError,
  devicesService,
  isAdmin,
  usersService,
} from "@internetderdinge/api";
import * as papersService from "../papers/papers.service";

interface AuthPayload {
  sub: string;
  roles?: string[];
}

interface CustomRequest extends Request {
  auth?: AuthPayload;
  currentUser?: unknown; // replace `unknown` with your actual User type
}

export const validateStore = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = req.auth!;
    // if admin, short‐circuit
    if (isAdmin(auth)) {
      return next();
    }

    const { storeId } = req.params;
    if (!storeId) {
      throw new ApiError(httpStatus.FORBIDDEN, "No paper (validatePaper)");
    }

    const paper = await papersService.getById(storeId);
    if (!paper) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Paper was not found (validatePaper)",
      );
    }

    const paperDevice = await devicesService.getById(paper.storeId);
    if (!paperDevice) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Device related to paper not found (validateQueryCalendarEntry)",
      );
    }

    const currentUser = await usersService.getUserByOwner(
      auth.sub,
      paperDevice.organization,
    );
    if (!currentUser) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You are not part of the organization which has access to the paper (validateDeviceUserOrganization)",
      );
    }

    req.currentUser = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};
