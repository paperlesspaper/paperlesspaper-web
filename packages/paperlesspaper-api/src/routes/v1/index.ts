import express from "express";

import papersRoute from "../../papers/papers.route";
import renderRoute from "../../render/render.route";
import supportRoute from "../../support/support.route";
import { adminSearchRoute } from "@internetderdinge/api";
import devicesRoute from "../../devices/devices.route";
import integrationPushRoute from "../../integrationPush/route.js";
import accountsRoute from "../../accounts/accounts.route.js";
import invitationsRoute from "../../invitations/invitations.route.js";
import {
  usersRoute,
  organizationsRoute,
  devicesNotificationsRoute,
  tokensRoute,
} from "@internetderdinge/api";

import slideshowMonitorRoute from "../../slideshowMonitor/route";

const router = express.Router();

// Handle invitation acceptance before the shared library's legacy endpoint.
router.use("/users", invitationsRoute, usersRoute);
router.use("/accounts", accountsRoute);
router.use("/organizations", organizationsRoute);
router.use("/devices", devicesRoute);
router.use("/integration-papers", integrationPushRoute);
router.use("/devicesNotifications", devicesNotificationsRoute);
router.use("/tokens", tokensRoute);
router.use("/papers", papersRoute);
router.use("/render", renderRoute);
router.use("/support", supportRoute);
router.use("/monitor", slideshowMonitorRoute);
router.use("/admin", adminSearchRoute);

export default router;
