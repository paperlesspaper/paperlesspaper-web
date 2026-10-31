import { Router } from "express";
import httpStatus from "http-status";
import { accountsRoute, ApiError } from "@internetderdinge/api";
import { auth, auth0, catchAsync } from "@internetderdinge/api";
import accountSecurityRoute from "./accountSecurity.route.js";

const router = Router();

router.use(accountSecurityRoute);

// Older clients include the unchanged email when saving a profile. Permit
// those saves, but close the legacy path that could bypass email verification.
const protectEmail = [
  auth(),
  catchAsync(async (req, _res, next) => {
    if (req.body?.email !== undefined) {
      const account = await auth0.users.get(req.auth.sub);
      if (req.body.email !== account.email) {
        throw new ApiError(
          400,
          "Use the separate email change action to update your email address."
        );
      }
      delete req.body.email;
    }
    next();
  }),
];
router.post("/:accountId", ...protectEmail);
router.patch("/:accountId", ...protectEmail);

router.post("/current/mfa/disable", (req, _res, next) => {
  // The shared router prefers X-API-Key over Bearer authentication. Reject
  // API-key requests here, including requests that supply both credentials.
  // Requests without an API key still undergo the shared JWT validation.
  if (req.headers["x-api-key"] !== undefined) {
    next(
      new ApiError(
        httpStatus.FORBIDDEN,
        "Disabling MFA requires a signed-in user. API keys are not allowed."
      )
    );
    return;
  }

  next();
});

router.use(accountsRoute);

export default router;
