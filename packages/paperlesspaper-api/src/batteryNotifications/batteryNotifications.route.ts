import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
type SignedInRequest = Request & { auth: { sub: string } };
import { z } from "zod";
import { auth, ApiError, catchAsync } from "@internetderdinge/api";
import { BatteryPreference } from "./batteryNotifications.model.js";

const router = Router();
const path = "/current/notifications/battery";
const preference = z.object({ email: z.boolean(), push: z.boolean() }).strict();

router.use(
  path,
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.headers["x-api-key"] !== undefined)
      return next(
        new ApiError(403, "Notification settings require a signed-in user.")
      );
    next();
  },
  auth()
);
router.get(
  path,
  catchAsync(async (req: SignedInRequest, res: Response) => {
    const value = await BatteryPreference.findById(req.auth.sub).lean();
    res.set("Cache-Control", "no-store").send({
      email: value?.email === true,
      push: value?.push === true,
    });
  })
);
router.put(
  path,
  catchAsync(async (req: SignedInRequest, res: Response) => {
    const parsed = preference.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "Expected email and push booleans.");
    await BatteryPreference.updateOne(
      { _id: req.auth.sub },
      { $set: parsed.data },
      { upsert: true }
    );
    res.send(parsed.data);
  })
);
export default router;
