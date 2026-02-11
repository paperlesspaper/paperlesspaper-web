import express from "express";

import papersRoute from "../../papers/papers.route";
import renderRoute from "../../render/render.route";
import {
  usersRoute,
  accountsRoute,
  organizationsRoute,
  devicesRoute,
  devicesNotificationsRoute,
  pdfRoute,
  tokensRoute,
} from "@internetderdinge/api";

const router = express.Router();

router.use("/users", usersRoute);
router.use("/accounts", accountsRoute);
router.use("/organizations", organizationsRoute);
router.use("/devices", devicesRoute);
router.use("/devicesNotifications", devicesNotificationsRoute);
router.use("/pdf", pdfRoute);
router.use("/tokens", tokensRoute);
router.use("/papers", papersRoute);
router.use("/render", renderRoute);

export default router;
