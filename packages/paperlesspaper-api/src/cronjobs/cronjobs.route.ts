import express from "express";

import auth from "@internetderdinge/api/src/middlewares/auth";
import cronjobsController from "./cronjobs.controller.js";
import { validateAdmin } from "@internetderdinge/api/src/middlewares/validateAdmin";

const router = express.Router();

router
  .route("/battery")
  .post(auth("manageUsers"), validateAdmin, cronjobsController.battery);

router
  .route("/papers")
  .post(auth("manageUsers"), validateAdmin, cronjobsController.papersCronjob);

export default router;
