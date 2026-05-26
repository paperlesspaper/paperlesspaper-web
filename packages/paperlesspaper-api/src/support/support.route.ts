import express from "express";
import type { Router } from "express";
import { auth } from "@internetderdinge/api";
import supportController from "./support.controller";

const router: Router = express.Router();

router
  .route("/chatwoot/identity")
  .get(auth("getUsers"), supportController.getChatwootIdentity);

export default router;
