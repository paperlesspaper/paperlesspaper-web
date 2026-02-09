import httpStatus from "http-status";
import ApiError from "@internetderdinge/api/src/utils/ApiError";
import papersService from "../papers/papers.service";
import devicesService from "@internetderdinge/api/common/devices/devices.service";
import { isAdmin } from "@internetderdinge/api/src/middlewares/validateAdmin";
import usersService from "@internetderdinge/api/src/users/users.service";

import type { Request, Response, NextFunction } from "express";

export const validatePaper = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (isAdmin(res.req.auth)) {
    next();
  } else {
    if (!req.params.paperId) {
      next(new ApiError(httpStatus.FORBIDDEN, "No paper (validatePaper)"));
      return;
    }
    const paper = await papersService.getById(req.params.paperId);
    if (!paper) {
      next(
        new ApiError(
          httpStatus.FORBIDDEN,
          "Paper was not found (validatePaper)",
        ),
      );
      return;
    }

    // Prefer paper.organization as source of truth; fall back to device.organization.
    let organizationId = paper.organization?.toString();

    if (!organizationId && paper.deviceId) {
      const paperDevice = await devicesService.getById(
        paper.deviceId.toString(),
      );
      if (!paperDevice) {
        next(
          new ApiError(
            httpStatus.FORBIDDEN,
            "Device related to paper not found and paper has no organization set (validatePaper)",
          ),
        );
        return;
      }
      organizationId = paperDevice.organization?.toString();
    }

    if (paper.organization && paper.deviceId) {
      const paperDevice = await devicesService.getById(
        paper.deviceId.toString(),
      );
      if (
        paperDevice?.organization &&
        paperDevice.organization.toString() !== paper.organization.toString()
      ) {
        next(
          new ApiError(
            httpStatus.FORBIDDEN,
            "Paper organization does not match device organization (validatePaper)",
          ),
        );
        return;
      }
    }

    if (!organizationId) {
      next(
        new ApiError(
          httpStatus.FORBIDDEN,
          "Paper is not associated with an organization (validatePaper)",
        ),
      );
      return;
    }

    const currentUser = await usersService.getUserByOwner(
      res.req.auth.sub,
      organizationId,
    );
    if (!currentUser) {
      next(
        new ApiError(
          httpStatus.FORBIDDEN,
          "You are not part of the organization which has access to the paper (validateDeviceUserOrganization)",
        ),
      );
      return;
    }
    req.currentUser = currentUser;
    next();
  }
};

export const validatePaperIsInOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const paperId = (req.body?.paper ||
    req.params?.paperId ||
    req.query?.paperId) as string | undefined;

  if (!paperId) {
    next();
    return;
  }

  const paper = await papersService.getById(paperId);

  if (!paper) {
    next();
    //next(new ApiError(httpStatus.NOT_FOUND, 'Paper not found'));
    return;
  }

  if (isAdmin(res.req.auth)) {
    next();
    return;
  }

  // Prefer paper.organization as confirmable scope; fall back to device.organization.
  let organizationId = paper.organization?.toString();

  if (!organizationId && paper.deviceId) {
    const paperDevice = await devicesService.getById(paper.deviceId.toString());
    if (paperDevice?.organization) {
      organizationId = paperDevice.organization.toString();
    }
  }

  if (paper.organization && paper.deviceId) {
    const paperDevice = await devicesService.getById(paper.deviceId.toString());
    if (
      paperDevice?.organization &&
      paperDevice.organization.toString() !== paper.organization.toString()
    ) {
      next(
        new ApiError(
          httpStatus.FORBIDDEN,
          "Paper organization does not match device organization",
        ),
      );
      return;
    }
  }

  if (!organizationId) {
    next(
      new ApiError(
        httpStatus.FORBIDDEN,
        "Paper is not associated with an organization",
      ),
    );
    return;
  }

  const currentUser = await usersService.getUserByOwner(
    res.req.auth.sub,
    organizationId,
  );

  if (!currentUser) {
    next(
      new ApiError(
        httpStatus.FORBIDDEN,
        "User is not part of the organization for this paper",
      ),
    );
    return;
  }

  if (
    req.body?.organization &&
    req.body.organization.toString() !== organizationId
  ) {
    next(
      new ApiError(
        httpStatus.FORBIDDEN,
        "Paper is not part of the provided organization",
      ),
    );
    return;
  }

  req.currentUser = currentUser;
  next();
};

export default { validatePaper };
