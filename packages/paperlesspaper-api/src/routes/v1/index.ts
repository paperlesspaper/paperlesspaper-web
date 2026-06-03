import express from "express";

import papersRoute from "../../papers/papers.route";
import renderRoute from "../../render/render.route";
import supportRoute from "../../support/support.route";
import { adminSearchRoute } from "@internetderdinge/api";
import devicesRoute from "../../devices/devices.route";
import iotdeviceRoute from "../../iotdevice/iotdevice.route";
import {
  usersRoute,
  accountsRoute,
  organizationsRoute,
  devicesNotificationsRoute,
  tokensRoute,
} from "@internetderdinge/api";

const router = express.Router();

router.use("/users", usersRoute);
router.use("/accounts", accountsRoute);
router.use("/organizations", organizationsRoute);
router.use("/devices", devicesRoute);
router.use("/iotdevice", iotdeviceRoute);
router.use("/devicesNotifications", devicesNotificationsRoute);
router.use("/tokens", tokensRoute);
router.use("/papers", papersRoute);
router.use("/render", renderRoute);
router.use("/support", supportRoute);
router.use("/admin", adminSearchRoute);

export default router;
