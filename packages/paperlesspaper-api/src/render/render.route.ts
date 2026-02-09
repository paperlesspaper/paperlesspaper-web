import express from "express";
import type { Router } from "express";
import validate from "@internetderdinge/api/src/middlewares/validate";
import renderValidation from "./render.validation.js";
import renderController from "./render.controller.js";
import { validateAdmin } from "@internetderdinge/api/src/middlewares/validateAdmin";
import auth from "@internetderdinge/api/src/middlewares/auth";

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
