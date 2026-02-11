import express from "express";
import type { Router } from "express";
import { auth, validate, validateAdmin } from "@internetderdinge/api";
import renderValidation from "./render.validation.js";
import renderController from "./render.controller.js";

const router: Router = express.Router();

router
  .route("/")
  .post(
    auth("manageUsers"),
    validateAdmin,
    validate(renderValidation.generatePdf),
    renderController.generateImageFromUrl,
  );

export default router;
