import crypto from "crypto";
import type { Request, Response } from "express";
import httpStatus from "http-status";
import { ApiError, catchAsync } from "@internetderdinge/api";

type AuthRequest = Request & {
  auth?: {
    email?: string;
    sub?: string;
  };
};

const getChatwootIdentity = catchAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const identifier = req.auth?.sub;

    if (!identifier) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate");
    }

    const hmacToken =
      process.env.CHATWOOT_HMAC_TOKEN ||
      process.env.CHATWOOT_IDENTITY_VALIDATION_TOKEN;

    res.send({
      email: req.auth?.email,
      identifier,
      identifierHash: hmacToken
        ? crypto.createHmac("sha256", hmacToken).update(identifier).digest("hex")
        : undefined,
      identityValidationConfigured: Boolean(hmacToken),
    });
  },
);

export default {
  getChatwootIdentity,
};
