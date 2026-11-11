import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { ApiError, auth, catchAsync } from "@internetderdinge/api";
import * as security from "./accountSecurity.service.js";
import { verifyRecentLogin } from "./reauthenticate.js";

const router = Router();
const limit = () =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
  });
// Never attach parsed bodies or validation results to errors: they may contain
// passwords and ID tokens. The shared validator retains successful body data.
const validateBody =
  ({ body }: { body: z.ZodObject }) =>
  (req: any, _res: any, next: any) => {
    const result = body.strict().safeParse(req.body);
    if (!result.success)
      return next(
        new ApiError(400, "Check the entered details and try again.")
      );
    req.body = result.data;
    next();
  };
const reauthToken = z.string().min(1).max(16_384);
const recentLogin = catchAsync(async (req, _res, next) => {
  await verifyRecentLogin(req.body.reauthToken, req.auth.sub, req.auth.azp);
  next();
});

// A random, single-use link proves possession of the NEW mailbox. GET requests
// never apply changes, so email scanners cannot accidentally confirm a change.
router.post(
  "/confirm-email",
  limit(),
  validateBody({
    body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }),
  }),
  catchAsync(async (req, res) => {
    await security.confirmEmailChange(req.body.token);
    res.send({ success: true });
  })
);

router.use(
  "/current/security",
  (req, _res, next) => {
    if (req.headers["x-api-key"] !== undefined)
      return next(
        new ApiError(403, "Account security requires a signed-in user.")
      );
    next();
  },
  auth()
);

router.get(
  "/current/security",
  catchAsync(async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .send(await security.securityStatus(req.auth.sub));
  })
);
router.use("/current/security", limit());
router.post(
  "/current/security/email",
  validateBody({
    body: z.object({
      email: z
        .email()
        .max(254)
        .transform((value) => value.trim().toLowerCase()),
      language: z.enum(["de", "en"]).default("en"),
      reauthToken,
    }),
  }),
  recentLogin,
  catchAsync(async (req, res) => {
    await security.requestEmailChange(
      req.auth.sub,
      req.body.email,
      req.body.language
    );
    res.send({ success: true });
  })
);
router.post(
  "/current/security/email/resend",
  catchAsync(async (req, res) => {
    await security.resendEmailChange(req.auth.sub);
    res.send({ success: true });
  })
);
router.delete(
  "/current/security/email",
  catchAsync(async (req, res) => {
    await security.cancelEmailChange(req.auth.sub);
    res.send({ success: true });
  })
);
router.post(
  "/current/security/password",
  validateBody({
    body: z.object({ password: z.string().min(8).max(128), reauthToken }),
  }),
  recentLogin,
  catchAsync(async (req, res) => {
    await security.changePassword(req.auth.sub, req.body.password);
    res.send({ success: true });
  })
);
router.post(
  "/current/security/password/reset",
  catchAsync(async (req, res) => {
    await security.resetPassword(req.auth.sub, req.auth.azp);
    res.send({ success: true });
  })
);

export default router;
