import { Router } from "express";
import httpStatus from "http-status";
import { z } from "zod";
import {
  ApiError,
  auth,
  catchAsync,
  User,
  validateZod,
  zObjectId,
} from "@internetderdinge/api";

const router = Router();

router.post(
  "/invite",
  auth("getUsers"),
  validateZod({
    body: z.object({
      organization: zObjectId,
      status: z.literal("accepted"),
      // Keep legacy code formats, but never allow null, missing or blank codes.
      inviteCode: z.string().min(1).max(256).regex(/^\S+$/),
    }),
  }),
  catchAsync(async (req, res) => {
    const owner = req.auth?.sub;
    if (typeof owner !== "string" || !owner) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate");
    }

    const { organization, inviteCode } = req.body;
    if (await User.exists({ owner, organization })) {
      throw new ApiError(httpStatus.CONFLICT, "User already in organization");
    }

    // Match and consume the invitation in one write so concurrent requests
    // cannot claim the same membership for different accounts.
    const user = await User.findOneAndUpdate(
      {
        organization,
        inviteCode,
        status: "invited",
        owner: { $exists: false },
      },
      { $set: { owner, status: "accepted", inviteCode: null } },
      { new: true, runValidators: true }
    );
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "Invite not found");
    }

    res.send(user);
  })
);

export default router;
