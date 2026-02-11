import express from "express";

import { auth, validateAdmin } from "@internetderdinge/api";
import cronjobsController from "./cronjobs.controller.js";

const router = express.Router();

router
  .route("/battery")
  .post(auth("manageUsers"), validateAdmin, cronjobsController.battery);

router
  .route("/papers")
  .post(auth("manageUsers"), validateAdmin, cronjobsController.papersCronjob);

export default router;
